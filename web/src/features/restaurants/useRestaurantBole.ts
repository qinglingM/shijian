import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export interface RestaurantBoleView {
  nickname: string | null
  awarded_at: string
}

export function useRestaurantBole(restaurantId: string | null) {
  return useQuery<RestaurantBoleView | null>({
    queryKey: ['restaurant-bole', restaurantId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('bole_records')
        .select('awarded_at, profiles(nickname)')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      type Row = { awarded_at: string; profiles: { nickname?: string | null } | null }
      const row = data as Row
      return {
        nickname: row.profiles?.nickname ?? null,
        awarded_at: row.awarded_at,
      }
    },
  })
}
