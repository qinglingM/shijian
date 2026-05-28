import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'
import type { RestaurantDishReviewItem } from '@/features/restaurants/useRestaurantDishReviews'
import { applyStoreReviewVoteClick } from '@/features/restaurants/storeReviewVotes'

export function useDishReviewVoteMutation(restaurantId: string | null) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async (vars: { dishReviewId: string; dishId: string; next: VoteType | null }) => {
      if (!isSupabaseConfigured || !restaurantId) {
        throw new Error('暂无可用后端')
      }
      if (!uid) throw new Error('请先登录')
      const sb = getSupabase()
      if (vars.next === null) {
        const { error } = await sb
          .from('review_votes')
          .delete()
          .match({
            user_id: uid,
            target_type: 'dish_review',
            target_id: vars.dishReviewId,
          })
        if (error) throw error
        return
      }
      const { error } = await sb.from('review_votes').upsert(
        {
          user_id: uid,
          target_type: 'dish_review',
          target_id: vars.dishReviewId,
          vote_type: vars.next,
        },
        { onConflict: 'user_id,target_type,target_id' },
      )
      if (error) throw error
    },
    onMutate: async (vars) => {
      const key = ['restaurant-dish-feed', restaurantId, uid]
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<RestaurantDishReviewItem[]>(key)
      if (!previous) return { previous }
      qc.setQueryData<RestaurantDishReviewItem[]>(key, (old) => {
        if (!old) return old
        return old.map((item) => {
          if (item.id !== vars.dishReviewId) return item
          const { youpin, yebang, mine } = applyStoreReviewVoteClick(
            item.youpin_count, item.yebang_count, item.my_vote, vars.next ?? 'youpin',
          )
          return { ...item, youpin_count: youpin, yebang_count: yebang, my_vote: mine }
        })
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['restaurant-dish-feed', restaurantId, uid], ctx.previous)
      }
    },
    onSettled(_data, _error, vars) {
      qc.invalidateQueries({ queryKey: ['dish-reviews', vars.dishId] })
    },
  })
}
