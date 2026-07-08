import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ContentReportReason, ContentReportTarget } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'
import { useReportedContentStore } from '@/stores/reportedContentStore'

export interface SubmitContentReportInput {
  targetType: ContentReportTarget
  targetId: string
  reasonCode: ContentReportReason
  description: string
  snapshot: Record<string, unknown>
}

export function useSubmitContentReportMutation() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const hideTarget = useReportedContentStore((s) => s.hideTarget)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SubmitContentReportInput) => {
      if (!isSupabaseConfigured) throw new Error('暂无可用后端')
      if (!userId) throw new Error('请先登录')

      const { error } = await getSupabase().from('content_reports').insert({
        reporter_user_id: userId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason_code: input.reasonCode,
        description: input.description.trim() || null,
        snapshot: input.snapshot,
      })

      if (error && error.code !== '23505') throw error
      return input
    },
    onSuccess: (input) => {
      hideTarget(input.targetType, input.targetId)
      void queryClient.invalidateQueries({ queryKey: ['my-content-reports', userId] })
    },
  })
}
