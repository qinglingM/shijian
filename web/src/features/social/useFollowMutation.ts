import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

export function useFollowMutation(targetUserId: string | null) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (isFollowing: boolean) => {
      if (!targetUserId) throw new Error('缺少用户 id')
      const sb = getSupabase()
      const { data: sessionData } = await sb.auth.getSession()
      const me = sessionData.session?.user?.id ?? null
      if (!me) throw new Error('请先登录')

      if (isFollowing) {
        const { error } = await sb
          .from('user_follows')
          .delete()
          .eq('follower_id', me)
          .eq('following_id', targetUserId)
        if (error) throw error
        return { following: false }
      }

      const { error } = await sb.from('user_follows').insert({
        follower_id: me,
        following_id: targetUserId,
      })
      if (error) throw error
      return { following: true }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user-profile', targetUserId] })
      await qc.invalidateQueries({ queryKey: ['follow-status', targetUserId] })
    },
  })
}
