import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'

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
    onSuccess(_data, vars) {
      if (restaurantId) {
        qc.invalidateQueries({ queryKey: ['restaurant-dish-feed', restaurantId] })
      }
      qc.invalidateQueries({ queryKey: ['dish-reviews', vars.dishId] })
    },
  })
}
