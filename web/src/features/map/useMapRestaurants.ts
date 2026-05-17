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
  tier: Tier | null
  top_reviewer_nickname: string | null
  top_reviewer_avatar_url: string | null
  top_store_comment: string | null
}

interface RestaurantRow {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
}

interface PracticeRow {
  id: string
  restaurant_id: string
  user_id: string
  tier: string
  store_comment: string | null
}

interface VoteRow {
  target_id: string
}

interface ProfileRow {
  id: string
  nickname: string | null
  avatar_url: string | null
}

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

      // 1. 所有有坐标的已入库餐厅
      const { data: raws, error: e1 } = await sb
        .from('restaurants')
        .select('id, display_name, latitude, longitude, city_name, district_name, cover_image_url')
        .eq('status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (e1) throw e1
      const restaurants = (raws ?? []) as RestaurantRow[]
      if (!restaurants.length) return []

      const ids = restaurants.map((r) => r.id)

      // 2. 这些餐厅的所有公开实践（含 tier + store_comment）
      const { data: praw, error: e2 } = await sb
        .from('practice_records')
        .select('id, restaurant_id, user_id, tier, store_comment')
        .in('restaurant_id', ids)
        .eq('is_public', true)
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
          tier: null,
          top_reviewer_nickname: null,
          top_reviewer_avatar_url: null,
          top_store_comment: null,
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

      // 有品最高的睿评：只取有 store_comment 的实践
      const practicesWithComment = practices.filter((p) => p.store_comment)
      const practiceIds = practicesWithComment.map((p) => p.id)
      const userIds = [...new Set(practicesWithComment.map((p) => p.user_id))]

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

      const profMap = new Map<string, { nickname: string; avatar_url: string | null }>()
      if (userIds.length) {
        const { data: profRaw, error: e4 } = await sb
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', userIds)
        if (e4) throw e4
        for (const p of (profRaw ?? []) as ProfileRow[]) {
          profMap.set(p.id, { nickname: p.nickname?.trim() || '食鉴用户', avatar_url: p.avatar_url ?? null })
        }
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

      return restaurants.map((r) => {
        const top = topByRestaurant.get(r.id) ?? null
        const tierCounts = tierCountsByRestaurant.get(r.id)
        return {
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          tier: tierCounts ? modeTier(tierCounts) : null,
          top_reviewer_nickname: top ? (profMap.get(top.user_id)?.nickname ?? '食鉴用户') : null,
          top_reviewer_avatar_url: top ? (profMap.get(top.user_id)?.avatar_url ?? null) : null,
          top_store_comment: top?.store_comment ?? null,
        }
      })
    },
  })
}
