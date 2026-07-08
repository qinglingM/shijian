import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ContentReportRow, ContentReportTarget } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'
import { useReportedContentStore } from '@/stores/reportedContentStore'

type HiddenReportRow = Pick<ContentReportRow, 'target_type' | 'target_id'>

export function useMyContentReports() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const hydrateFromReports = useReportedContentStore((s) => s.hydrateFromReports)
  const reset = useReportedContentStore((s) => s.reset)

  const query = useQuery<HiddenReportRow[]>({
    queryKey: ['my-content-reports', userId],
    enabled: isSupabaseConfigured && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('content_reports')
        .select('target_type,target_id')
        .eq('reporter_user_id', userId!)

      if (error) throw error
      return (data ?? []) as HiddenReportRow[]
    },
  })

  useEffect(() => {
    if (!userId) {
      reset()
      return
    }
    if (query.data) hydrateFromReports(query.data)
  }, [hydrateFromReports, query.data, reset, userId])

  return query
}

export function useIsReportedHidden(targetType: ContentReportTarget, targetId: string | null | undefined) {
  return useReportedContentStore((s) => (targetId ? Boolean(s.hiddenTargets[targetType]?.[targetId]) : false))
}
