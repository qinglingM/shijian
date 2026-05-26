import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'
import type { StoreReviewItem } from '@/features/restaurants/useStoreReviewsByRestaurant'
import { applyStoreReviewVoteClick } from '@/features/restaurants/storeReviewVotes'

export function useStoreReviewVoteMutation(restaurantId: string | null) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async (vars: { practiceRecordId: string; next: VoteType | null }) => {
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
            target_type: 'store_review',
            target_id: vars.practiceRecordId,
          })
        if (error) throw error
        return
      }
      const { error } = await sb.from('review_votes').upsert(
        {
          user_id: uid,
          target_type: 'store_review',
          target_id: vars.practiceRecordId,
          vote_type: vars.next,
        },
        { onConflict: 'user_id,target_type,target_id' },
      )
      if (error) throw error
    },
    onMutate: async (vars) => {
      const key = ['store-reviews', restaurantId, uid]
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<StoreReviewItem[]>(key)
      if (!previous) return { previous }
      qc.setQueryData<StoreReviewItem[]>(key, (old) => {
        if (!old) return old
        return old.map((item) => {
          if (item.id !== vars.practiceRecordId) return item
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
        qc.setQueryData(['store-reviews', restaurantId, uid], ctx.previous)
      }
    },
    onSettled() {
      if (restaurantId) {
        qc.invalidateQueries({ queryKey: ['store-reviews', restaurantId] })
      }
    },
  })
}
