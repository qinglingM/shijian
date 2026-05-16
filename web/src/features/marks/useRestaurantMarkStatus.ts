import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/** 对照门店页：`reviewed` 优先于仍处于 marks 的行 */
export type RestaurantMarkUiStatus = 'reviewed' | 'marked' | 'fresh'

export function useRestaurantMarkStatus(
  viewerId: string | null,
  restaurantId: string | null,
) {
  return useQuery<RestaurantMarkUiStatus>({
    queryKey: ['restaurant-mark-status', viewerId, restaurantId],
    enabled: isSupabaseConfigured && !!viewerId && !!restaurantId,
    queryFn: async () => {
      const uid = viewerId!
      const rid = restaurantId!
      const sb = getSupabase()

      const [prRow, mkRow] = await Promise.all([
        sb
          .from('practice_records')
          .select('id')
          .eq('user_id', uid)
          .eq('restaurant_id', rid)
          .eq('is_valid_practice', true)
          .eq('is_active', true)
          .maybeSingle(),
        sb.from('marks').select('id').eq('user_id', uid).eq('restaurant_id', rid).maybeSingle(),
      ])

      if (prRow.error) throw prRow.error
      if (mkRow.error) throw mkRow.error

      if (prRow.data) return 'reviewed'
      if (mkRow.data) return 'marked'
      return 'fresh'
    },
  })
}
