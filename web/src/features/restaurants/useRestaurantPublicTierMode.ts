import { useQuery } from '@tanstack/react-query'
import { averageTierFloor, type Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export function useRestaurantPublicTierMode(restaurantId: string | null | undefined) {
  const id = restaurantId ?? null
  return useQuery({
    queryKey: ['restaurant-tier-mode', id],
    enabled: isSupabaseConfigured && !!id,
    retry: false,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('practice_records')
        .select('tier')
        .eq('restaurant_id', id!)
        .eq('is_active', true)

      if (error) throw error
      const rows = (data ?? []) as { tier: string }[]
      return averageTierFloor(rows.map((r) => r.tier as Tier))
    },
  })
}
