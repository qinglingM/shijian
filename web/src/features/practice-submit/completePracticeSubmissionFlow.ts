import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import type { PracticeDoneLocationState } from '@/pages/practice/PracticeDonePage'
import { usePracticeDraft } from '@/stores/practiceDraft'

import { submitPractice, type SubmitPracticeDraft } from '@/features/practice-submit/submitPractice'
import { invalidateAfterPracticeSubmit } from '@/features/practice-submit/invalidateAfterPracticeSubmit'

/**
 * 提交食鉴成功后的统一收尾：失效查询 → 关弹窗 → 去完成页 → 清空草稿（避免先 reset 触发第三步误跳 step1）。
 */
export async function completePracticeSubmissionFlow(opts: {
  draft: SubmitPracticeDraft
  queryClient: QueryClient
  userId: string | null
  navigate: NavigateFunction
  brandNameSnapshot?: string
  onBeforeReset?: () => void
}): Promise<void> {
  const { draft, queryClient, userId, navigate, brandNameSnapshot, onBeforeReset } = opts
  const rid = draft.existing_restaurant_id
  const wasUpdate = draft.will_replace_existing_practice

  const { restaurant_id } = await submitPractice(draft)

  await invalidateAfterPracticeSubmit(queryClient, {
    restaurantId: restaurant_id,
    existingRestaurantId: rid,
    userId,
  })

  onBeforeReset?.()

  navigate('/practice/done', {
    state: {
      restaurantId: restaurant_id,
      brandName: brandNameSnapshot,
      wasUpdate,
    } satisfies PracticeDoneLocationState,
  })

  usePracticeDraft.getState().reset()
}
