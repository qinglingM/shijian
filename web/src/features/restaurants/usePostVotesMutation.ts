import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'

export function usePostVoteMutation(postId: string | null) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async (next: VoteType | null) => {
      if (!isSupabaseConfigured || !postId) throw new Error('暂无可用后端')
      if (!uid) throw new Error('请先登录')
      const sb = getSupabase()
      if (next === null) {
        const { error } = await sb
          .from('review_votes')
          .delete()
          .match({ user_id: uid, target_type: 'post', target_id: postId })
        if (error) throw error
        return
      }
      const { error } = await sb.from('review_votes').upsert(
        { user_id: uid, target_type: 'post', target_id: postId, vote_type: next },
        { onConflict: 'user_id,target_type,target_id' },
      )
      if (error) throw error
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['square-feed'] })
    },
  })
}
