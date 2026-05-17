import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export interface MapRestaurant {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
  // 有品数最高的那条睿评
  top_reviewer_nickname: string | null
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
  store_comment: string | null
}

interface VoteRow {
  target_id: string
}

interface ProfileRow {
  id: string
  nickname: string | null
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

      // 2. 这些餐厅的所有公开实践（含 store_comment）
      const { data: praw, error: e2 } = await sb
        .from('practice_records')
        .select('id, restaurant_id, user_id, store_comment')
        .in('restaurant_id', ids)
        .eq('is_public', true)
        .eq('is_active', true)
        .not('store_comment', 'is', null)

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
          top_reviewer_nickname: null,
          top_store_comment: null,
        }))
      }

      const practiceIds = practices.map((p) => p.id)
      const userIds = [...new Set(practices.map((p) => p.user_id))]

      // 3. 这些实践的「有品」投票数
      const { data: vraw, error: e3 } = await sb
        .from('review_votes')
        .select('target_id')
        .in('target_id', practiceIds)
        .eq('target_type', 'store_review')
        .eq('vote_type', 'youpin')

      if (e3) throw e3
      const votes = (vraw ?? []) as VoteRow[]

      // 4. 评价人昵称
      const { data: profRaw, error: e4 } = await sb
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds)

      if (e4) throw e4
      const profMap = new Map<string, string>()
      for (const p of (profRaw ?? []) as ProfileRow[]) {
        profMap.set(p.id, p.nickname?.trim() || '食鉴用户')
      }

      // 统计每条实践的有品数
      const youPinCount = new Map<string, number>()
      for (const v of votes) {
        youPinCount.set(v.target_id, (youPinCount.get(v.target_id) ?? 0) + 1)
      }

      // 每家餐厅找有品数最高的那条实践
      const topByRestaurant = new Map<string, PracticeRow & { score: number }>()
      for (const p of practices) {
        if (!p.store_comment) continue
        const score = youPinCount.get(p.id) ?? 0
        const cur = topByRestaurant.get(p.restaurant_id)
        if (!cur || score > cur.score) {
          topByRestaurant.set(p.restaurant_id, { ...p, score })
        }
      }

      return restaurants.map((r) => {
        const top = topByRestaurant.get(r.id) ?? null
        return {
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          city_name: r.city_name,
          district_name: r.district_name,
          cover_image_url: r.cover_image_url,
          top_reviewer_nickname: top ? (profMap.get(top.user_id) ?? '食鉴用户') : null,
          top_store_comment: top?.store_comment ?? null,
        }
      })
    },
  })
}
