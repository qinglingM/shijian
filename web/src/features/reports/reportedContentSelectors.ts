import type { HiddenTargetsMap } from '@/stores/reportedContentStore'

export function isPracticeRecordHidden(hiddenTargets: HiddenTargetsMap, practiceRecordId: string | null | undefined) {
  return Boolean(practiceRecordId && hiddenTargets.practice_record?.[practiceRecordId])
}

export function isDishReviewHidden(hiddenTargets: HiddenTargetsMap, dishReviewId: string | null | undefined) {
  if (!dishReviewId) return false
  return Boolean(hiddenTargets.dish_review?.[dishReviewId] || hiddenTargets.dish_review_image?.[dishReviewId])
}

export function filterVisiblePracticeRecords<T extends { id: string }>(items: T[], hiddenTargets: HiddenTargetsMap) {
  return items.filter((item) => !isPracticeRecordHidden(hiddenTargets, item.id))
}

export function filterVisibleDishReviews<T extends { id: string }>(items: T[], hiddenTargets: HiddenTargetsMap) {
  return items.filter((item) => !isDishReviewHidden(hiddenTargets, item.id))
}
