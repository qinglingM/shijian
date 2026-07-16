import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { averageTierFloor, type Tier } from '@/lib/db'

export interface MapRestaurant {
  id: string
  display_name: string
  latitude: number
  longitude: number
  province_name: string | null
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
  address_text: string | null
  category_label: string | null
  big_category_name: string | null
  amap_mid_category: string | null
  amap_small_category: string | null
  tier: Tier | null
  top_reviewer_nickname: string | null
  top_reviewer_avatar_url: string | null
  top_practice_record_id: string | null
  top_reviewer_user_id: string | null
  top_store_comment: string | null
  review_tier: Tier | null
  review_youpin: number
  review_created_at: string | null
  practice_count: number
  titleName: string | null
  titleRarity: string | null
}

interface RestaurantRow {
  id: string
  display_name: string
  latitude: number
  longitude: number
  province_name: string | null
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
  address_text: string | null
  display_category_label: string | null
  amap_mid_category: string | null
  amap_small_category: string | null
}

interface PracticeRow {
  id: string
  restaurant_id: string
  user_id: string
  tier: string
  store_comment: string | null
  created_at: string
}

interface ProfileRow {
  id: string
  nickname: string
  avatar_url: string | null
  current_title_id: string | null
}

interface VoteRow {
  target_id: string
}

const ANONYMOUS_REVIEWER = '匿名食客'

export function useMapRestaurants() {
  return useQuery<MapRestaurant[]>({
    queryKey: ['map-restaurants'],
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = getSupabase()

      const { data: raws, error: e1 } = await sb
        .from('restaurants')
        .select('id, display_name, latitude, longitude, province_name, city_name, district_name, cover_image_url, address_text, display_category_label, amap_mid_category, amap_small_category, categories(name)')
        .eq('status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(1000)

      if (e1) throw e1
      const rawRows = (raws ?? []) as (RestaurantRow & { categories: { name?: string } | { name?: string }[] | null })[]
      const restaurants: (RestaurantRow & { category_label: string | null; big_category_name: string | null })[] = rawRows.map((r) => {
        const nested = r.categories
        let category_name: string | null = null
        if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.name != null)
          category_name = String(nested.name)
        else if (Array.isArray(nested) && nested[0]?.name != null)
          category_name = String(nested[0].name)
        const { categories: _omit, ...core } = r
        void _omit
        const category_label =
          r.display_category_label?.trim() ||
          category_name?.trim() ||
          r.amap_small_category?.trim() ||
          r.amap_mid_category?.trim() ||
          null
        return { ...core, category_label, big_category_name: category_name || null }
      })
      if (!restaurants.length) return []

      // 重复坐标微偏移，避免 Supercluster 无法展开
      const seenCoords = new Set<string>()
      for (const r of restaurants) {
        const key = `${r.latitude},${r.longitude}`
        if (seenCoords.has(key)) {
          r.latitude += (Math.random() - 0.5) * 0.0002
          r.longitude += (Math.random() - 0.5) * 0.0002
        } else {
          seenCoords.add(key)
        }
      }

      const ids = restaurants.map((r) => r.id)

      // 2. 这些餐厅的所有公开实践（含 tier + store_comment）
      const { data: praw, error: e2 } = await sb
        .from('practice_records')
        .select('id, restaurant_id, user_id, tier, store_comment, created_at')
        .in('restaurant_id', ids)
        .eq('is_active', true)

      if (e2) throw e2
      const practices = (praw ?? []) as PracticeRow[]

      if (!practices.length) {
        return restaurants.map((r) => ({
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          province_name: r.province_name,
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          address_text: null,
          category_label: r.category_label,
          big_category_name: r.big_category_name,
          amap_mid_category: r.amap_mid_category,
          amap_small_category: r.amap_small_category,
          tier: null,
          top_reviewer_nickname: null,
          top_reviewer_avatar_url: null,
          top_practice_record_id: null,
          top_reviewer_user_id: null,
          top_store_comment: null,
          review_tier: null,
          review_youpin: 0,
          review_created_at: null,
          practice_count: 0,
          titleName: null,
          titleRarity: null,
        }))
      }

      // 全用户平均档（向下取整）
      const tiersByRestaurant = new Map<string, Tier[]>()
      for (const p of practices) {
        const t = p.tier as Tier
        if (!tiersByRestaurant.has(p.restaurant_id)) {
          tiersByRestaurant.set(p.restaurant_id, [])
        }
        tiersByRestaurant.get(p.restaurant_id)!.push(t)
      }

      // 餐厅食鉴总人次
      const practiceCountByRestaurant = new Map<string, number>()
      for (const p of practices) {
        practiceCountByRestaurant.set(p.restaurant_id, (practiceCountByRestaurant.get(p.restaurant_id) ?? 0) + 1)
      }

      // 有品最高的睿评：只取有 store_comment 的实践
      const practicesWithComment = practices.filter((p) => p.store_comment)
      const practiceIds = practicesWithComment.map((p) => p.id)
      let votes: VoteRow[] = []
      if (practiceIds.length) {
        const { data: vraw, error: e3 } = await sb
          .from('review_votes')
          .select('target_id')
          .in('target_id', practiceIds)
          .eq('target_type', 'store_review')
          .eq('vote_type', 'youpin')
        if (e3) throw e3
        votes = (vraw ?? []) as VoteRow[]
      }

      const youPinCount = new Map<string, number>()
      for (const v of votes) {
        youPinCount.set(v.target_id, (youPinCount.get(v.target_id) ?? 0) + 1)
      }

      const topByRestaurant = new Map<string, PracticeRow & { score: number }>()
      for (const p of practicesWithComment) {
        if (!p.store_comment) continue
        const score = youPinCount.get(p.id) ?? 0
        const cur = topByRestaurant.get(p.restaurant_id)
        if (!cur || score > cur.score) {
          topByRestaurant.set(p.restaurant_id, { ...p, score })
        }
      }

      // 查最热评价中非匿名用户的 profile
      const topPractices = [...topByRestaurant.values()]
      const nonAnonUserIds = [...new Set(topPractices.map((p) => p.user_id))]
      const profileMap = new Map<string, ProfileRow>()
      if (nonAnonUserIds.length) {
        const { data: profilesRaw } = await sb
          .from('profiles')
          .select('id, nickname, avatar_url, current_title_id')
          .in('id', nonAnonUserIds)
        for (const p of (profilesRaw ?? []) as ProfileRow[]) {
          profileMap.set(p.id, p)
        }
      }

      const titleIds = [...new Set([...profileMap.values()].map(p => p.current_title_id).filter(Boolean))] as string[]
      const titleMap = new Map<string, { name: string; rarity: string }>()
      if (titleIds.length > 0) {
        const { data: utRows } = await sb.from('user_titles').select('id, title_id, titles!inner(name, rarity)').in('id', titleIds)
        for (const ut of (utRows ?? []) as unknown as Array<{id: string; titles: {name: string; rarity: string}}>) {
          const t = ut.titles
          if (t?.name) titleMap.set(ut.id, { name: t.name, rarity: t.rarity })
        }
      }

      return restaurants.map((r) => {
        const top = topByRestaurant.get(r.id) ?? null
        const profile = top ? profileMap.get(top.user_id) ?? null : null
        return {
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          province_name: r.province_name,
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          address_text: r.address_text,
          category_label: r.category_label,
          big_category_name: r.big_category_name,
          amap_mid_category: r.amap_mid_category,
          amap_small_category: r.amap_small_category,
          tier: averageTierFloor(tiersByRestaurant.get(r.id) ?? []),
          top_reviewer_nickname: top ? (profile ? profile.nickname : ANONYMOUS_REVIEWER) : null,
          top_reviewer_avatar_url: profile ? profile.avatar_url : null,
          top_practice_record_id: top?.id ?? null,
          top_reviewer_user_id: top?.user_id ?? null,
          titleName: titleMap.get(profile?.current_title_id ?? '')?.name ?? null,
          titleRarity: titleMap.get(profile?.current_title_id ?? '')?.rarity ?? null,
          top_store_comment: top?.store_comment ?? null,
          review_tier: top ? (top.tier as Tier) : null,
          review_youpin: top?.score ?? 0,
          review_created_at: top?.created_at ?? null,
          practice_count: practiceCountByRestaurant.get(r.id) ?? 0,
        }
      })
    },
  })
}
