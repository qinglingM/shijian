import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export interface GuidanceSummaryRow {
  feedback_count: number
  /** 勾选「存在好评诱导」占比，无反馈时为 null */
  guidance_rate_pct: number | null
}

export function useRestaurantGuidanceSummary(restaurantId: string | null) {
  return useQuery<GuidanceSummaryRow>({
    queryKey: ['guidance-summary', restaurantId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('guidance_feedback')
        .select('has_guidance')
        .eq('restaurant_id', restaurantId!)

      if (error) throw error
      const rows = (data ?? []) as { has_guidance: boolean }[]
      const total = rows.length
      const pos = rows.filter((r) => r.has_guidance === true).length
      return {
        feedback_count: total,
        guidance_rate_pct: total > 0 ? Math.round((pos / total) * 100) : null,
      }
    },
  })
}
