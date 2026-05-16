import type { QueryClient } from '@tanstack/react-query'

/**
 * submit-practice 成功后需刷新的与本店 / 档位图 /「我的」相关查询。
 */
export async function invalidateAfterPracticeSubmit(
  queryClient: QueryClient,
  args: {
    restaurantId: string
    existingRestaurantId: string | null
    userId: string | null
  },
): Promise<void> {
  const { restaurantId: restaurant_id, existingRestaurantId: rid, userId } = args
  await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurant_id] })
  await queryClient.invalidateQueries({ queryKey: ['tier-map'] })
  if (rid) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['restaurant', rid] }),
      queryClient.invalidateQueries({ queryKey: ['dishes', rid] }),
      queryClient.invalidateQueries({ queryKey: ['store-reviews', rid] }),
      queryClient.invalidateQueries({ queryKey: ['restaurant-dish-reviews', rid] }),
      queryClient.invalidateQueries({ queryKey: ['restaurant-bole', rid] }),
      queryClient.invalidateQueries({ queryKey: ['restaurant-guidance-summary', rid] }),
    ])
  }
  if (userId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-marks-feed', userId] }),
      queryClient.invalidateQueries({ queryKey: ['my-bole-records', userId] }),
      queryClient.invalidateQueries({ queryKey: ['me-summary', userId] }),
      ...(rid
        ? [
            queryClient.invalidateQueries({
              queryKey: ['restaurant-mark-status', userId, rid],
            }),
          ]
        : []),
    ])
  }
}
