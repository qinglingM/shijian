/**
 * 「提交预览 / 第三步按钮」用到的：与快照对比判断是否相对基线发生过修改。
 */

import type { Tier } from '@/lib/db'

import type { DraftDishReview } from '@/stores/practiceDraft'

export interface DishComparableRow {
  dish_id: string | null
  name: string
  score: number | null
  comment: string
  image_ref: string
  is_public: boolean
}

/** 与用户可见编辑项一致的可比快照（不包含 client_id） */
export interface PracticeSubmissionBaseline {
  tier: Tier
  store_comment: string
  dishes: DishComparableRow[]
}

export type PracticeDraftDirtyInput = {
  tier: Tier | null
  store_comment: string
  is_public: boolean
  dishes: DraftDishReview[]
  submission_baseline: PracticeSubmissionBaseline | null
  submission_baseline_practice_public_snapshot: boolean | null
}

function normImageUrl(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function dishComparableFromDraftRow(d: DraftDishReview): DishComparableRow {
  return {
    dish_id: d.dish_id,
    name: d.name.trim(),
    score: d.score,
    comment: d.comment.trim(),
    image_ref: normImageUrl(d.image_url),
    is_public: d.is_public,
  }
}

function dishSortKey(d: DishComparableRow): string {
  return d.dish_id ? `id:${d.dish_id}` : `nm:${d.name}`
}

/** 无序 multiset：避免因列表顺序误判 */
function sortedDishesComparable(dishes: DraftDishReview[]): DishComparableRow[] {
  return [...dishes].map(dishComparableFromDraftRow).sort((a, b) => {
    const ka = dishSortKey(a)
    const kb = dishSortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    const sa = `${a.score ?? '∅'}:${a.comment}:${a.image_ref}:${a.is_public ? 1 : 0}`
    const sb = `${b.score ?? '∅'}:${b.comment}:${b.image_ref}:${b.is_public ? 1 : 0}`
    return sa < sb ? -1 : sa > sb ? 1 : 0
  })
}

export function buildSubmissionBaseline(
  tier: Tier,
  store_comment: string,
  comparableDishes: DishComparableRow[],
): PracticeSubmissionBaseline {
  const sorted = [...comparableDishes].sort((a, b) => {
    const ka = dishSortKey(a)
    const kb = dishSortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    const sa = `${a.score ?? '∅'}:${a.comment}:${a.image_ref}:${a.is_public ? 1 : 0}`
    const sb = `${b.score ?? '∅'}:${b.comment}:${b.image_ref}:${b.is_public ? 1 : 0}`
    return sa < sb ? -1 : sa > sb ? 1 : 0
  })
  return {
    tier,
    store_comment: store_comment.trim(),
    dishes: sorted,
  }
}

export function submissionBaselineUnequal(
  a: PracticeSubmissionBaseline,
  b: PracticeSubmissionBaseline,
): boolean {
  if (a.tier !== b.tier) return true
  if (a.store_comment.trim() !== b.store_comment.trim()) return true
  if (a.dishes.length !== b.dishes.length) return true
  for (let i = 0; i < a.dishes.length; i++) {
    const x = a.dishes[i]
    const y = b.dishes[i]
    if (x.dish_id !== y.dish_id || x.name !== y.name || x.score !== y.score) return true
    if (x.comment !== y.comment || x.image_ref !== y.image_ref) return true
    if (x.is_public !== y.is_public) return true
  }
  return false
}

export function snapshotFromDraftLike(state: PracticeDraftDirtyInput): PracticeSubmissionBaseline {
  const tier = state.tier!
  return {
    tier,
    store_comment: state.store_comment.trim(),
    dishes: sortedDishesComparable(state.dishes),
  }
}

/** 第三步：相对基线是否有任意可见修改（整单是否公开也算） */
export function isPracticeSubmissionDirty(state: PracticeDraftDirtyInput): boolean {
  if (!state.submission_baseline || !state.tier) return false
  const snapHold = state.submission_baseline_practice_public_snapshot
  if (snapHold !== null && snapHold !== state.is_public) return true
  return submissionBaselineUnequal(state.submission_baseline, snapshotFromDraftLike(state))
}
