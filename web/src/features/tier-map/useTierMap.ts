import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSimulatedPractices, type SimulatedPracticeRecord } from '@/stores/simulatedPractices'
import { TIER_ORDER, averageTierFloor, type Tier } from '@/lib/db'
import { useCityStore } from '@/features/city-picker/cityStore'

export interface TierMapItem {
  id: string
  display_name: string
  cover_image_url: string | null
  /** 美食分类（与数据库 categories.id 对齐） */
  category_id: string | null
  category_name: string | null
  city_id: string | null
  city_name: string | null
  latitude: number | null
  longitude: number | null
  amap_mid_category: string | null
  amap_small_category: string | null
  /** practice_records.created_at；模拟数据为 null */
  practiced_at: string | null
}

export interface TierBucket {
  tier: Tier
  /** 冗余字段便于类型兼容，取值恒等于 restaurants.length */
  count: number
  restaurants: TierMapItem[]
}

export interface TierMapResult {
  buckets: TierBucket[]
  total_count: number
}

/** 筛选「数据库无分类」占位键（仅存于前端筛选状态） */
export const TIER_MAP_UNCATEGORIZED_FILTER = '__uncategorized__' as const

export function filterTierMapByCategory(
  map: TierMapResult,
  categoryFilter: string | null,
): TierMapResult {
  if (categoryFilter === null) return map

  const buckets = map.buckets.map((b) => {
    const restaurants = b.restaurants.filter((r) => {
      if (categoryFilter === TIER_MAP_UNCATEGORIZED_FILTER)
        return r.category_id == null || r.category_id === ''

      return r.category_id === categoryFilter
    })
    return { tier: b.tier, count: restaurants.length, restaurants }
  })

  const total_count = buckets.reduce((s, b) => s + b.restaurants.length, 0)
  return { buckets, total_count }
}

/** 供筛选状态校验：当前食鉴图中仍存在的分类 id，以及是否存在未分类项 */
export function summarizeTierMapCategoryKeys(buckets: TierBucket[]): {
  categoryIds: Set<string>
  hasUncategorized: boolean
} {
  const categoryIds = new Set<string>()
  let hasUncategorized = false
  for (const b of buckets) {
    for (const r of b.restaurants) {
      const id = r.category_id
      if (id != null && id !== '') categoryIds.add(id)
      else hasUncategorized = true
    }
  }
  return { categoryIds, hasUncategorized }
}

/** 食鉴图按当前城市收窄（顶栏选「全部」或不选具体城时不按城筛） */
export function applyTierMapCityScope(
  map: TierMapResult,
  opts: { showAllChina: boolean; cityId: string | null },
): TierMapResult {
  if (opts.showAllChina || !opts.cityId) return map

  const buckets = map.buckets.map((b) => {
    const restaurants = b.restaurants.filter((r) => r.city_id === opts.cityId)
    return { tier: b.tier, count: restaurants.length, restaurants }
  })
  const total_count = buckets.reduce((s, b) => s + b.restaurants.length, 0)
  return { buckets, total_count }
}

const EMPTY_RESULT: TierMapResult = {
  total_count: 0,
  buckets: TIER_ORDER.map((tier) => ({ tier, count: 0, restaurants: [] })),
}

interface PracticeRestaurantRow {
  id: string
  display_name: string
  cover_image_url: string | null
  category_id: string | null
  city_id?: string | null
  city_name?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  amap_mid_category?: string | null
  amap_small_category?: string | null
  /** Supabase 嵌套 categories 表；有时为单对象，少数配置下为数组 */
  categories?: { name: string } | { name: string }[] | null
}

interface PracticeRow {
  tier: Tier
  created_at: string
  restaurant: PracticeRestaurantRow | null
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function tierMapItemFromPracticeRestaurant(row: PracticeRestaurantRow | null): TierMapItem | null {
  if (!row) return null
  const nested = row.categories
  let category_name: string | null = null
  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    'name' in nested &&
    nested.name != null
  ) {
    category_name = String(nested.name)
  } else if (Array.isArray(nested) && nested[0] && nested[0].name != null) {
    category_name = String(nested[0].name)
  }

  return {
    id: row.id,
    display_name: row.display_name,
    cover_image_url: row.cover_image_url ?? null,
    category_id: row.category_id ?? null,
    category_name,
    city_id: row.city_id ?? null,
    city_name: row.city_name?.trim() ?? null,
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    amap_mid_category: row.amap_mid_category?.trim() ?? null,
    amap_small_category: row.amap_small_category?.trim() ?? null,
    practiced_at: null,
  }
}

export function useTierMap() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const simulatedRecords = useSimulatedPractices((s) => s.records)

  const query = useQuery<TierMapResult>({
    queryKey: ['tier-map', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<TierMapResult> => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('practice_records')
        .select(
          'tier, created_at, restaurant:restaurants(id, display_name, cover_image_url, category_id, city_id, city_name, latitude, longitude, display_category_label, amap_mid_category, amap_small_category, categories(name))',
        )
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as unknown as PracticeRow[]

      // 收集这家用户的餐厅 ID，再查全用户平均档
      const ownedRids = [...new Set(rows.map((r) => r.restaurant?.id).filter(Boolean))] as string[]

      const avgTierByRest = new Map<string, Tier>()
      if (ownedRids.length > 0) {
        const { data: allTiersRaw } = await supabase
          .from('practice_records')
          .select('restaurant_id, tier')
          .in('restaurant_id', ownedRids)
          .eq('is_active', true)
        const allTiers = (allTiersRaw ?? []) as Array<{ restaurant_id: string; tier: string }>
        const acc = new Map<string, Tier[]>()
        for (const t of allTiers) {
          if (!acc.has(t.restaurant_id)) acc.set(t.restaurant_id, [])
          acc.get(t.restaurant_id)!.push(t.tier as Tier)
        }
        for (const [rid, tiers] of acc) {
          const avg = averageTierFloor(tiers)
          if (avg) avgTierByRest.set(rid, avg)
        }
      }

      const grouped: Record<Tier, TierMapItem[]> = {
        boom: [],
        hang: [],
        top: [],
        upper: [],
        npc: [],
        bad: [],
      }
      for (const r of rows) {
        const item = tierMapItemFromPracticeRestaurant(r.restaurant)
        if (!item) continue
        const rid = r.restaurant?.id
        const tier = rid ? (avgTierByRest.get(rid) ?? r.tier as Tier) : r.tier as Tier
        grouped[tier].push({ ...item, practiced_at: r.created_at })
      }

      const buckets = TIER_ORDER.map((tier) => {
        const restaurants = grouped[tier]
        return { tier, count: restaurants.length, restaurants }
      })
      const total_count = buckets.reduce((s, b) => s + b.restaurants.length, 0)

      return { total_count, buckets }
    },
  })

  const data = useMemo(
    () => mergeSimulatedRecords(query.data ?? EMPTY_RESULT, simulatedRecords),
    [query.data, simulatedRecords],
  )

  return { ...query, data }
}

export function getEmptyTierMap(): TierMapResult {
  return EMPTY_RESULT
}

/**
 * 与首页食鉴图同源：使用真实聚合数据（含本地模拟提交）。
 * 档位详情页等子路由应使用此 hook，才能保证与食鉴图互通。
 */
export function useDisplayedTierMap() {
  const tierMapShowsAllChina = useCityStore((s) => s.tierMapShowsAllChina)
  const cityId = useCityStore((s) => s.cityId)

  const query = useTierMap()
  const mergedData = query.data ?? EMPTY_RESULT
  const map = useMemo(() => {
    return applyTierMapCityScope(mergedData, {
      showAllChina: tierMapShowsAllChina,
      cityId,
    })
  }, [mergedData, tierMapShowsAllChina, cityId])

  return {
    ...query,
    map,
  }
}

function mergeSimulatedRecords(
  base: TierMapResult,
  simulatedRecords: SimulatedPracticeRecord[],
): TierMapResult {
  const grouped = Object.fromEntries(
    TIER_ORDER.map((tier) => [
      tier,
      [...(base.buckets.find((b) => b.tier === tier)?.restaurants ?? [])],
    ]),
  ) as Record<Tier, TierMapItem[]>

  for (const record of simulatedRecords) {
    grouped[record.tier].unshift({
      id: record.restaurant.id,
      display_name: record.restaurant.display_name,
      cover_image_url: record.restaurant.cover_image_url ?? null,
      category_id: record.restaurant.category_id ?? null,
      category_name: record.restaurant.category_name ?? null,
      city_id: record.restaurant.city_id ?? null,
      city_name: record.restaurant.city_name ?? null,
      latitude: record.restaurant.latitude ?? null,
      longitude: record.restaurant.longitude ?? null,
      amap_mid_category: record.restaurant.amap_mid_category ?? null,
      amap_small_category: record.restaurant.amap_small_category ?? null,
      practiced_at: new Date().toISOString(),
    })
  }

  const buckets = TIER_ORDER.map((tier) => ({
    tier,
    count: grouped[tier].length,
    restaurants: grouped[tier],
  }))

  return {
    total_count: buckets.reduce((s, b) => s + b.restaurants.length, 0),
    buckets,
  }
}
