import { useQuery } from '@tanstack/react-query'
import { TIER_ORDER, type Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

function modeTierFromRows(rows: { tier: string }[]): Tier | null {
  if (!rows.length) return null
  const counts = new Map<Tier, number>()
  for (const r of rows) {
    const t = r.tier as Tier
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }

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
      return modeTierFromRows((data ?? []) as { tier: string }[])
    },
  })
}
