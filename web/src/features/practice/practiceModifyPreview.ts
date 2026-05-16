/**
 * 「修改预览」：相对 submission_baseline 仅列出有变化的项。
 */

import type { Tier } from '@/lib/db'

import type { DishComparableRow, PracticeSubmissionBaseline } from './practiceSubmissionBaseline'

function rowEqual(a: DishComparableRow, b: DishComparableRow): boolean {
  return (
    a.dish_id === b.dish_id &&
    a.name === b.name &&
    a.score === b.score &&
    a.comment === b.comment &&
    a.image_ref === b.image_ref &&
    a.is_public === b.is_public
  )
}

export type ModifyPreviewSection =
  | { kind: 'tier'; before: Tier; after: Tier }
  | { kind: 'store_comment'; before: string; after: string }
  | { kind: 'is_public'; before: boolean; after: boolean }
  | { kind: 'dish_added'; dish: DishComparableRow }
  | { kind: 'dish_removed'; dish: DishComparableRow }
  | { kind: 'dish_changed'; before: DishComparableRow; after: DishComparableRow }

/** 逐项对比 before=基线(SERVER) → after=当前草稿 */
export function computeModifySections(
  before: PracticeSubmissionBaseline,
  after: PracticeSubmissionBaseline,
  isPublicBefore: boolean,
  isPublicAfter: boolean,
): ModifyPreviewSection[] {
  const sections: ModifyPreviewSection[] = []

  if (before.tier !== after.tier) {
    sections.push({ kind: 'tier', before: before.tier, after: after.tier })
  }

  const bsc = before.store_comment.trim()
  const asc = after.store_comment.trim()
  if (bsc !== asc) {
    sections.push({ kind: 'store_comment', before: bsc, after: asc })
  }

  if (isPublicBefore !== isPublicAfter) {
    sections.push({ kind: 'is_public', before: isPublicBefore, after: isPublicAfter })
  }

  const bs = [...before.dishes]
  const als = [...after.dishes]

  for (let i = bs.length - 1; i >= 0; i--) {
    const j = als.findIndex((a) => rowEqual(bs[i], a))
    if (j >= 0) {
      bs.splice(i, 1)
      als.splice(j, 1)
    }
  }

  const changedPairs: { b: DishComparableRow; a: DishComparableRow }[] = []

  for (let i = bs.length - 1; i >= 0; i--) {
    const br = bs[i]
    if (!br.dish_id) continue
    const j = als.findIndex((a) => a.dish_id === br.dish_id)
    if (j >= 0) {
      changedPairs.push({ b: br, a: als[j] })
      bs.splice(i, 1)
      als.splice(j, 1)
    }
  }

  for (const { b: br, a: ar } of changedPairs) {
    sections.push({ kind: 'dish_changed', before: br, after: ar })
  }

  for (const d of bs) sections.push({ kind: 'dish_removed', dish: d })
  for (const d of als) sections.push({ kind: 'dish_added', dish: d })

  return sections
}

export function getModifySectionLabel(section: ModifyPreviewSection): string {
  switch (section.kind) {
    case 'tier':
      return '档位'
    case 'store_comment':
      return '整店锐评'
    case 'is_public':
      return '可见范围'
    case 'dish_removed':
      return '移除菜品'
    case 'dish_added':
      return '新增菜品'
    case 'dish_changed':
      return '菜品修改'
  }
}
