import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { DishRow } from '@/lib/db'

export type DishLite = Pick<
  DishRow,
  | 'id'
  | 'name'
  | 'cover_image_url'
  | 'avg_score'
  | 'review_count'
  | 'top_comment'
  | 'youpin_count'
  | 'yebang_count'
>

export function useDishesByRestaurant(restaurantId: string | null) {
  return useQuery<DishLite[]>({
    queryKey: ['dishes', restaurantId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('dishes')
        .select(
          'id, name, cover_image_url, avg_score, review_count, top_comment, youpin_count, yebang_count',
        )
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'active')
        .order('review_count', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as DishLite[]
    },
  })
}
