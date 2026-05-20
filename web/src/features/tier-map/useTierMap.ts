import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSimulatedPractices, type SimulatedPracticeRecord } from '@/stores/simulatedPractices'
import { TIER_ORDER, type Tier } from '@/lib/db'
import { useCityStore } from '@/features/city-picker/cityStore'
import {
  type TierMapDemoStore,
  useTierMapDemoStore,
} from '@/features/tier-map/tierMapDemoStore'

export interface TierMapItem {
  id: string
  display_name: string
  cover_image_url: string | null
  /** 美食分类（与数据库 categories.id 对齐；示例数据可使用 demo-* 占位） */
  category_id: string | null
  category_name: string | null
  city_id: string | null
  latitude: number | null
  longitude: number | null
  /** practice_records.created_at；模拟/示例数据为 null */
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

/** demo 示例用分类 id（与种子里的名称对应，仅占位不参与后端） */
const DC = {
  huoguo: 'demo-cat-huoguo',
  skewer: 'demo-cat-shaokao',
  fanguan: 'demo-cat-fanguan',
  yintian: 'demo-cat-yintian',
  fenmian: 'demo-cat-fenmian',
  xiaochi: 'demo-cat-xiaochi',
  jianchan: 'demo-cat-jianchan',
} as const

/** 仅用「餐厅列表」描述示例档，数量由列表长度推导，避免字段不一致 */
const MOCK_REST_BY_TIER: Record<Tier, TierMapItem[]> = {
  boom: [
    {
      id: 'demo-1',
      display_name: '海底捞·紫竹桥',
      cover_image_url: null,
      category_id: DC.huoguo,
      category_name: '火锅',
      city_id: null,
      latitude: 39.9612,
      longitude: 116.3084,
      practiced_at: null,
    },
    {
      id: 'demo-2',
      display_name: '丰茂烤串',
      cover_image_url: null,
      category_id: DC.skewer,
      category_name: '烧烤',
      city_id: null,
      latitude: 39.9371,
      longitude: 116.3262,
      practiced_at: null,
    },
    {
      id: 'demo-3',
      display_name: '南京大牌档',
      cover_image_url: null,
      category_id: DC.fanguan,
      category_name: '饭馆',
      city_id: null,
      latitude: 39.9042,
      longitude: 116.4074,
      practiced_at: null,
    },
  ],
  hang: [
    {
      id: 'demo-4',
      display_name: '局气·三里屯',
      cover_image_url: null,
      category_id: DC.fanguan,
      category_name: '饭馆',
      city_id: null,
      latitude: 39.9336,
      longitude: 116.4474,
      practiced_at: null,
    },
    {
      id: 'demo-5',
      display_name: '喜茶',
      cover_image_url: null,
      category_id: DC.yintian,
      category_name: '饮甜',
      city_id: null,
      latitude: 39.9192,
      longitude: 116.3982,
      practiced_at: null,
    },
  ],
  top: [
    {
      id: 'demo-6',
      display_name: '味千拉面',
      cover_image_url: null,
      category_id: DC.fenmian,
      category_name: '粉面',
      city_id: null,
      latitude: 39.9891,
      longitude: 116.3185,
      practiced_at: null,
    },
  ],
  upper: [
    {
      id: 'demo-7',
      display_name: '隆福寺小吃',
      cover_image_url: null,
      category_id: DC.xiaochi,
      category_name: '小吃',
      city_id: null,
      latitude: 39.9242,
      longitude: 116.4124,
      practiced_at: null,
    },
    {
      id: 'demo-8',
      display_name: '南门涮肉',
      cover_image_url: null,
      category_id: DC.huoguo,
      category_name: '火锅',
      city_id: null,
      latitude: 39.9394,
      longitude: 116.4032,
      practiced_at: null,
    },
    {
      id: 'demo-9',
      display_name: '蓝蛙',
      cover_image_url: null,
      category_id: DC.jianchan,
      category_name: '简餐',
      city_id: null,
      latitude: 39.9102,
      longitude: 116.4552,
      practiced_at: null,
    },
    {
      id: 'demo-10',
      display_name: '一坐一忘',
      cover_image_url: null,
      category_id: DC.fanguan,
      category_name: '饭馆',
      city_id: null,
      latitude: 39.9055,
      longitude: 116.4432,
      practiced_at: null,
    },
  ],
  npc: [],
  bad: [],
}

function bucketsFromRestaurantLists(restByTier: Record<Tier, TierMapItem[]>): TierBucket[] {
  return TIER_ORDER.map((tier) => {
    const restaurants = restByTier[tier] ?? []
    return {
      tier,
      count: restaurants.length,
      restaurants,
    }
  })
}

export const MOCK_TIER_MAP: TierMapResult = (() => {
  const buckets = bucketsFromRestaurantLists(MOCK_REST_BY_TIER)
  return {
    total_count: buckets.reduce((s, b) => s + b.restaurants.length, 0),
    buckets,
  }
})()

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
  latitude?: number | string | null
  longitude?: number | string | null
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
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    practiced_at: null,
  }
}

export function useTierMap() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const simulatedRecords = useSimulatedPractices((s) => s.records)

  const query = useQuery<TierMapResult>({
    queryKey: ['tier-map', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TierMapResult> => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('practice_records')
        .select(
          'tier, created_at, restaurant:restaurants(id, display_name, cover_image_url, category_id, city_id, latitude, longitude, display_category_label, categories(name))',
        )
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as unknown as PracticeRow[]

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
        if (item) grouped[r.tier].push({ ...item, practiced_at: r.created_at })
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
 * 与首页食鉴图同源：手动示例 + dev 下未登录且无数据时自动示例，否则用真实聚合数据（含模拟提交）。
 * 档位详情页等子路由应使用此 hook，才能保证与食鉴图互通。
 */
export function useDisplayedTierMap() {
  const manualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.manualShowDemo)
  const userReady = useAuthStore((s) => !!s.user)
  const tierMapShowsAllChina = useCityStore((s) => s.tierMapShowsAllChina)
  const cityId = useCityStore((s) => s.cityId)

  const query = useTierMap()
  const mergedData = query.data ?? EMPTY_RESULT
  const hasPracticeData = mergedData.total_count > 0

  const showingDemo =
    manualShowDemo ||
    (!userReady && import.meta.env.DEV && !hasPracticeData)

  const baseMap: TierMapResult = showingDemo ? MOCK_TIER_MAP : mergedData

  const map = useMemo(() => {
    if (showingDemo) return baseMap
    return applyTierMapCityScope(baseMap, {
      showAllChina: tierMapShowsAllChina,
      cityId,
    })
  }, [baseMap, showingDemo, tierMapShowsAllChina, cityId])

  return {
    ...query,
    map,
    showingDemo,
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
      latitude: record.restaurant.latitude ?? null,
      longitude: record.restaurant.longitude ?? null,
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
