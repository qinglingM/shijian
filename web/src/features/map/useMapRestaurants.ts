import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { TIER_ORDER, type Tier } from '@/lib/db'

export interface MapRestaurant {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
  address_text: string | null
  category_name: string | null
  tier: Tier | null
  top_reviewer_nickname: string | null
  top_reviewer_avatar_url: string | null
  top_store_comment: string | null
  review_tier: Tier | null
  review_youpin: number
  review_created_at: string | null
  practice_count: number
}

interface RestaurantRow {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
  address_text: string | null
}

interface PracticeRow {
  id: string
  restaurant_id: string
  user_id: string
  tier: string
  store_comment: string | null
  is_anonymous: boolean
  created_at: string
}

interface ProfileRow {
  id: string
  nickname: string
  avatar_url: string | null
}

interface VoteRow {
  target_id: string
}

const ANONYMOUS_REVIEWER = '匿名食客'

function modeTier(counts: Map<Tier, number>): Tier | null {
  let best: Tier | null = null
  let bestCount = -1
  for (const t of TIER_ORDER) {
    const n = counts.get(t) ?? 0
    if (n > bestCount) {
      best = t
      bestCount = n
    }
  }
  return best
}

export function useMapRestaurants() {
  return useQuery<MapRestaurant[]>({
    queryKey: ['map-restaurants'],
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = getSupabase()

      // 1. 所有有坐标的已入库餐厅（含分类中文名）
      const { data: raws, error: e1 } = await sb
        .from('restaurants')
        .select('id, display_name, latitude, longitude, city_name, district_name, cover_image_url, address_text, categories(name)')
        .eq('status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (e1) throw e1
      const rawRows = (raws ?? []) as (RestaurantRow & { categories: { name?: string } | { name?: string }[] | null })[]
      const restaurants: (RestaurantRow & { category_name: string | null })[] = rawRows.map((r) => {
        const nested = r.categories
        let category_name: string | null = null
        if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.name != null)
          category_name = String(nested.name)
        else if (Array.isArray(nested) && nested[0]?.name != null)
          category_name = String(nested[0].name)
        const { categories: _omit, ...core } = r
        void _omit
        return { ...core, category_name }
      })
      if (!restaurants.length) return []

      const ids = restaurants.map((r) => r.id)

      // 2. 这些餐厅的所有公开实践（含 tier + store_comment）
      const { data: praw, error: e2 } = await sb
        .from('practice_records')
        .select('id, restaurant_id, user_id, tier, store_comment, is_anonymous, created_at')
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
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          address_text: null,
          category_name: r.category_name,
          tier: null,
          top_reviewer_nickname: null,
          top_reviewer_avatar_url: null,
          top_store_comment: null,
          review_tier: null,
          review_youpin: 0,
          review_created_at: null,
          practice_count: 0,
        }))
      }

      // 众数等级：用所有实践计算
      const tierCountsByRestaurant = new Map<string, Map<Tier, number>>()
      for (const p of practices) {
        const t = p.tier as Tier
        if (!tierCountsByRestaurant.has(p.restaurant_id)) {
          tierCountsByRestaurant.set(p.restaurant_id, new Map())
        }
        const counts = tierCountsByRestaurant.get(p.restaurant_id)!
        counts.set(t, (counts.get(t) ?? 0) + 1)
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
      const nonAnonUserIds = [...new Set(topPractices.filter((p) => !p.is_anonymous).map((p) => p.user_id))]
      const profileMap = new Map<string, ProfileRow>()
      if (nonAnonUserIds.length) {
        const { data: profilesRaw } = await sb
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', nonAnonUserIds)
        for (const p of (profilesRaw ?? []) as ProfileRow[]) {
          profileMap.set(p.id, p)
        }
      }

      return restaurants.map((r) => {
        const top = topByRestaurant.get(r.id) ?? null
        const tierCounts = tierCountsByRestaurant.get(r.id)
        const profile = top && !top.is_anonymous ? profileMap.get(top.user_id) ?? null : null
        return {
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          address_text: r.address_text,
          category_name: r.category_name,
          tier: tierCounts ? modeTier(tierCounts) : null,
          top_reviewer_nickname: top ? (profile ? profile.nickname : ANONYMOUS_REVIEWER) : null,
          top_reviewer_avatar_url: profile ? profile.avatar_url : null,
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
