import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Tier } from '@/lib/db'

export interface MapRestaurant {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  created_by: string
  creator_nickname: string
  creator_avatar_url: string | null
  practice_id: string | null
  tier: Tier | null
  store_comment: string | null
}

interface RestaurantRow {
  id: string
  display_name: string
  latitude: number
  longitude: number
  city_name: string | null
  district_name: string | null
  created_by: string
  profiles: { nickname: string | null; avatar_url: string | null } | null
}

interface PracticeRow {
  id: string
  restaurant_id: string
  user_id: string
  tier: string
  store_comment: string | null
}

export function useMapRestaurants() {
  return useQuery<MapRestaurant[]>({
    queryKey: ['map-restaurants'],
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = getSupabase()

      const { data: raws, error: e1 } = await sb
        .from('restaurants')
        .select('id, display_name, latitude, longitude, city_name, district_name, created_by, profiles:created_by(nickname, avatar_url)')
        .eq('status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (e1) throw e1
      const restaurants = (raws ?? []) as RestaurantRow[]
      if (!restaurants.length) return []

      const ids = restaurants.map((r) => r.id)
      const { data: praw, error: e2 } = await sb
        .from('practice_records')
        .select('id, restaurant_id, user_id, tier, store_comment')
        .in('restaurant_id', ids)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (e2) throw e2
      const practices = (praw ?? []) as PracticeRow[]

      const practiceMap = new Map<string, PracticeRow>()
      for (const p of practices) {
        if (practiceMap.has(p.restaurant_id)) continue
        const rest = restaurants.find((r) => r.id === p.restaurant_id)
        if (rest && p.user_id === rest.created_by) {
          practiceMap.set(p.restaurant_id, p)
        }
      }

      return restaurants.map((r) => {
        const prof = r.profiles
        const practice = practiceMap.get(r.id) ?? null
        return {
          id: r.id,
          display_name: r.display_name,
          latitude: r.latitude,
          longitude: r.longitude,
          city_name: r.city_name,
          district_name: r.district_name,
          created_by: r.created_by,
          creator_nickname: prof?.nickname?.trim() || '食鉴用户',
          creator_avatar_url: prof?.avatar_url ?? null,
          practice_id: practice?.id ?? null,
          tier: (practice?.tier as Tier) ?? null,
          store_comment: practice?.store_comment ?? null,
        }
      })
    },
  })
}
