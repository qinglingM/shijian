import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import { usePracticeDraft } from '@/stores/practiceDraft'

import { submitPractice, type SubmitPracticeDraft } from '@/features/practice-submit/submitPractice'
import { invalidateAfterPracticeSubmit } from '@/features/practice-submit/invalidateAfterPracticeSubmit'

function resetPracticeDraftAfterRouteCommit() {
  const reset = () => {
    usePracticeDraft.getState().reset()
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(reset)
  })
}

/**
 * 提交食鉴成功后的统一收尾：失效查询 → 关弹窗 → 回到本次餐厅详情页 → 清空草稿（避免先 reset 触发第三步误跳 step1）。
 */
export async function completePracticeSubmissionFlow(opts: {
  draft: SubmitPracticeDraft
  queryClient: QueryClient
  userId: string | null
  navigate: NavigateFunction
  onBeforeReset?: () => void
}): Promise<void> {
  const { draft, queryClient, userId, navigate, onBeforeReset } = opts
  const rid = draft.existing_restaurant_id

  const { restaurant_id } = await submitPractice(draft)

  await invalidateAfterPracticeSubmit(queryClient, {
    restaurantId: restaurant_id,
    existingRestaurantId: rid,
    userId,
  })

  onBeforeReset?.()

  const returnTo = usePracticeDraft.getState().returnTo ?? '/tier-map'
  navigate(returnTo, { replace: true })

  resetPracticeDraftAfterRouteCommit()
}
