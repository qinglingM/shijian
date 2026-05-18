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

  // 食鉴图 + 美食地图
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tier-map'] }),
    queryClient.invalidateQueries({ queryKey: ['map-restaurants'] }),
  ])

  // 最终落库的店铺（新店或老店）
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['restaurant', restaurant_id] }),
    queryClient.invalidateQueries({ queryKey: ['store-reviews', restaurant_id] }),
    queryClient.invalidateQueries({ queryKey: ['dishes', restaurant_id] }),
    queryClient.invalidateQueries({ queryKey: ['restaurant-dish-reviews', restaurant_id] }),
    queryClient.invalidateQueries({ queryKey: ['restaurant-bole', restaurant_id] }),
    queryClient.invalidateQueries({ queryKey: ['restaurant-guidance-summary', restaurant_id] }),
  ])

  // 若是更新已有店，额外刷旧 rid（通常与 restaurant_id 相同，防止极端情况）
  if (rid && rid !== restaurant_id) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['restaurant', rid] }),
      queryClient.invalidateQueries({ queryKey: ['store-reviews', rid] }),
      queryClient.invalidateQueries({ queryKey: ['dishes', rid] }),
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
      queryClient.invalidateQueries({ queryKey: ['restaurant-mark-status', userId, restaurant_id] }),
      ...(rid && rid !== restaurant_id
        ? [queryClient.invalidateQueries({ queryKey: ['restaurant-mark-status', userId, rid] })]
        : []),
    ])
  }
}
