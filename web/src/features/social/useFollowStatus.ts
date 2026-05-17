import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

export function useFollowStatus(targetUserId: string | null) {
  return useQuery({
    queryKey: ['follow-status', targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data: sessionData } = await sb.auth.getSession()
      const me = sessionData.session?.user?.id ?? null
      if (!me) return { following: false, followers: 0, followingCount: 0, isSelf: false }

      const [followResult, followersResult, followingResult] = await Promise.all([
        sb
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', me)
          .eq('following_id', targetUserId!),
        sb
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', targetUserId!),
        sb
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', targetUserId!),
      ])

      if (followResult.error) throw followResult.error
      if (followersResult.error) throw followersResult.error
      if (followingResult.error) throw followingResult.error

      return {
        following: (followResult.count ?? 0) > 0,
        followers: followersResult.count ?? 0,
        followingCount: followingResult.count ?? 0,
        isSelf: me === targetUserId,
      }
    },
  })
}
