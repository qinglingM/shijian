import type { QueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

export async function deletePracticeContent(args: { recordId: string; dishId?: string }) {
  const { recordId, dishId } = args
  const supabase = getSupabase()

  if (dishId) {
    const { error } = await supabase
      .from('dish_reviews')
      .update({ is_active: false })
      .eq('id', dishId)
    if (error) throw error
    return
  }

  const { data: reviews, error: listError } = await supabase
    .from('dish_reviews')
    .select('id')
    .eq('practice_record_id', recordId)
    .eq('is_active', true)
  if (listError) throw listError

  if (reviews && reviews.length > 0) {
    const { error: dishError } = await supabase
      .from('dish_reviews')
      .update({ is_active: false })
      .in('id', reviews.map((review) => review.id))
    if (dishError) throw dishError
  }

  const { error } = await supabase
    .from('practice_records')
    .update({ is_active: false })
    .eq('id', recordId)
  if (error) throw error
}

export async function invalidateAfterPracticeDelete(
  queryClient: QueryClient,
  args: { restaurantId: string | null; userId: string | null },
) {
  const { restaurantId, userId } = args

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['square-feed'] }),
    queryClient.invalidateQueries({ queryKey: ['today-practice-count'] }),
    queryClient.invalidateQueries({ queryKey: ['tier-map'] }),
    queryClient.invalidateQueries({ queryKey: ['map-restaurants'] }),
    ...(restaurantId
      ? [
          queryClient.invalidateQueries({ queryKey: ['store-reviews', restaurantId] }),
          queryClient.invalidateQueries({ queryKey: ['restaurant-dish-feed', restaurantId] }),
          queryClient.invalidateQueries({ queryKey: ['guidance-summary', restaurantId] }),
          queryClient.invalidateQueries({ queryKey: ['restaurant-bole', restaurantId] }),
        ]
      : []),
    ...(restaurantId && userId
      ? [queryClient.invalidateQueries({ queryKey: ['my-practice-check', restaurantId, userId] })]
      : []),
    ...(userId
      ? [
          queryClient.invalidateQueries({ queryKey: ['me-practices', userId] }),
          queryClient.invalidateQueries({ queryKey: ['me-summary', userId] }),
        ]
      : []),
  ])
}
