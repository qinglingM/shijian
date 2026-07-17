import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { UserBlockRow } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'
import { useBlockedUsersStore } from '@/stores/blockedUsersStore'

type BlockedUserRow = Pick<UserBlockRow, 'blocked_user_id'>

export function useMyBlockedUsers() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const hydrateFromBlocks = useBlockedUsersStore((s) => s.hydrateFromBlocks)
  const reset = useBlockedUsersStore((s) => s.reset)

  const query = useQuery<BlockedUserRow[]>({
    queryKey: ['my-blocked-users', userId],
    enabled: isSupabaseConfigured && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('user_blocks')
        .select('blocked_user_id')
        .eq('blocker_user_id', userId!)

      if (error) throw error
      return (data ?? []) as BlockedUserRow[]
    },
  })

  useEffect(() => {
    if (!userId) {
      reset()
      return
    }
    if (query.data) hydrateFromBlocks(query.data)
  }, [hydrateFromBlocks, query.data, reset, userId])

  return query
}
