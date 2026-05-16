/**
 * 提交预览 / 修改预览：左右信息块 + 固定宽度箭头列（模板）。
 */

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

import {
  TIER_BLOCK_TEXT_CLASS,
  TIER_LABEL,
  TIER_SOFT_VAR,
  type Tier,
} from '@/lib/db'

import type { DraftDishReview } from '@/stores/practiceDraft'

import type { DishComparableRow } from '@/features/practice/practiceSubmissionBaseline'

import type { ModifyPreviewSection } from './practiceModifyPreview'
import { getModifySectionLabel } from './practiceModifyPreview'

const ARROW_COL = 'w-9 shrink-0'

/** 提交预览：仅当前用户所选档位的一只微缩色块，档名字写在方块内（与 TierLabelBlock 同色） */
function SubmitPreviewTierBlock({ selectedTier }: { selectedTier: Tier | null }) {
  if (!selectedTier) {
    return (
      <div
        className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100/90 px-0.5 text-center text-[8px] font-medium leading-tight text-neutral-500"
        aria-label="未选择六档评价"
      >
        未选档位
      </div>
    )
  }
  const label = TIER_LABEL[selectedTier]
  return (
    <div
      className={`relative flex size-10 shrink-0 flex-col items-center justify-center overflow-hidden rounded px-0.5 shadow-sm ring-1 ring-black/15 ${TIER_BLOCK_TEXT_CLASS}`}
      style={{ background: TIER_SOFT_VAR[selectedTier] }}
      aria-label={`六档评价：${label}`}
      title={label}
    >
      <span className="line-clamp-2 select-none text-center text-[9px] font-bold leading-tight tracking-tight text-neutral-950">
        {label}
      </span>
    </div>
  )
}

export function PreviewSnapshotCell({
  muted,
  children,
}: {
  muted?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`flex min-h-[4.25rem] min-w-0 flex-1 flex-col justify-center rounded-lg border px-2 py-2 text-[10px] leading-snug ${
        muted
          ? 'border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-400'
          : 'border-neutral-200/90 bg-neutral-50/95 text-neutral-800'
      }`}
    >
      {children}
    </div>
  )
}

/** 箭头列：固定占位，避免随左右块内容宽度漂移 */
export function PreviewArrowColumn() {
  return (
    <div className={`${ARROW_COL} flex items-center justify-center self-stretch`} aria-hidden>
      <ArrowRight className="size-5 shrink-0 text-orange-500" strokeWidth={2.25} />
    </div>
  )
}

export function DishComparableCell({ d }: { d: DishComparableRow }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-neutral-900">{d.name.trim() || '(未命名)'}</p>
      <p className="text-neutral-600">{d.score === null ? '未评分' : `${d.score} 分`}</p>
      {d.comment.trim() ? (
        <p className="line-clamp-3 text-neutral-500">{d.comment.trim()}</p>
      ) : (
        <p className="text-neutral-400">（无锐评）</p>
      )}
      {d.image_ref.trim() ? (
        <p className="text-[9px] font-medium text-orange-700/90">含配图</p>
      ) : null}
      <p className="text-[9px] text-neutral-500">{d.is_public ? '公开本条' : '不公开展示本条'}</p>
    </div>
  )
}

export function PreviewEmptyPlaceholderCell({ text = '—' }: { text?: string }) {
  return (
    <PreviewSnapshotCell muted>
      <p className="text-center text-[10px]">{text}</p>
    </PreviewSnapshotCell>
  )
}

/** 单层模板：标签 +（左｜箭头｜右） */
export function PreviewDiffUnitShell({
  label,
  left,
  right,
}: {
  label: string
  left: ReactNode
  right: ReactNode
}) {
  return (
    <div className="rounded-xl border border-neutral-200/90 bg-white p-2.5 shadow-sm shadow-neutral-900/5">
      <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-neutral-500">
        {label}
      </p>
      <div className="flex items-stretch gap-1">
        {left}
        <PreviewArrowColumn />
        {right}
      </div>
    </div>
  )
}

/** 首次评价的「提交预览」：单列紧凑概览（无对照数据，不搞左右分栏）。 */
export function SubmitFullPreviewContent({
  brandName,
  tier,
  isPublic,
  storeComment,
  dishes,
}: {
  brandName: string | null | undefined
  tier: Tier | null
  isPublic: boolean
  storeComment: string
  dishes: DraftDishReview[]
}) {
  const visibilityLabel = isPublic ? '公开评价' : '不公开展示'

  const scTrim = storeComment.trim()
  return (
    <div className="mt-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 text-sm leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-neutral-600">店铺名称：</p>
          <p className="mt-1 break-words text-base font-semibold leading-snug text-neutral-900">
            {brandName?.trim() || '（未选店铺）'}
          </p>
        </div>
        <SubmitPreviewTierBlock selectedTier={tier} />
      </div>

      <div className="mt-3 border-t border-neutral-200/70 pt-2.5">
        <span className="text-xs font-semibold tracking-wide text-neutral-600">整店锐评</span>
        {scTrim ? (
          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-[15px] leading-snug text-neutral-800">
            {scTrim}
          </p>
        ) : (
          <p className="mt-1.5 text-[15px] text-neutral-400">（未填）</p>
        )}
      </div>

      {dishes.length > 0 ? (
        <div className="mt-3 border-t border-neutral-200/70 pt-2.5">
          <span className="text-xs font-semibold tracking-wide text-neutral-600">
            菜品 · {dishes.length} 道
          </span>
          <ul className="mt-2 space-y-2">
            {dishes.map((d, idx) => {
              const name = d.name.trim() || '未命名'
              const scoreBefore = d.score === null ? '--分' : `${d.score} 分`
              const cmt = d.comment.trim()
              const hasImg = !!(d.image_url ?? '').trim()
              return (
                <li key={d.client_id} className="min-w-0">
                  <p className="text-[15px] leading-snug text-neutral-900">
                    <span className="tabular-nums font-semibold text-orange-600">{idx + 1}.</span>{' '}
                    <span className="font-medium text-neutral-700">{scoreBefore}</span>{' '}
                    <span className="font-semibold">{name}</span>
                  </p>
                  <p
                    className={`mt-1 line-clamp-2 whitespace-pre-wrap break-words leading-snug ${
                      cmt ? 'text-[14px] text-neutral-600' : 'text-[14px] text-neutral-400'
                    }`}
                  >
                    评价：{cmt || '（未填）'}
                  </p>
                  {hasImg ? (
                    <p className="mt-1 text-xs text-neutral-500">含配图</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 border-t border-neutral-200/70 pt-2.5 text-sm text-neutral-400">
          未添加菜品
        </p>
      )}

      <div className="mt-4 border-t border-neutral-200/80 pt-3 text-center text-sm font-semibold text-neutral-800">
        {visibilityLabel}
      </div>
    </div>
  )
}

export function ModifyPreviewDiffUnit({ section }: { section: ModifyPreviewSection }) {
  const label = getModifySectionLabel(section)

  let left: ReactNode
  let right: ReactNode

  switch (section.kind) {
    case 'tier':
      left = (
        <PreviewSnapshotCell>
          <p className="text-center font-semibold text-neutral-900">{TIER_LABEL[section.before]}</p>
        </PreviewSnapshotCell>
      )
      right = (
        <PreviewSnapshotCell>
          <p className="text-center font-semibold text-neutral-900">{TIER_LABEL[section.after]}</p>
        </PreviewSnapshotCell>
      )
      break
    case 'store_comment': {
      const b = section.before.trim() || '（未填）'
      const a = section.after.trim() || '（未填）'
      left = (
        <PreviewSnapshotCell>
          <p className="line-clamp-6 whitespace-pre-wrap break-words">{b}</p>
        </PreviewSnapshotCell>
      )
      right = (
        <PreviewSnapshotCell>
          <p className="line-clamp-6 whitespace-pre-wrap break-words">{a}</p>
        </PreviewSnapshotCell>
      )
      break
    }
    case 'is_public':
      left = (
        <PreviewSnapshotCell>
          <p className="text-center font-medium">{section.before ? '公开评价' : '不公开展示'}</p>
        </PreviewSnapshotCell>
      )
      right = (
        <PreviewSnapshotCell>
          <p className="text-center font-medium">{section.after ? '公开评价' : '不公开展示'}</p>
        </PreviewSnapshotCell>
      )
      break
    case 'dish_added':
      left = <PreviewEmptyPlaceholderCell />
      right = (
        <PreviewSnapshotCell>
          <DishComparableCell d={section.dish} />
        </PreviewSnapshotCell>
      )
      break
    case 'dish_removed':
      left = (
        <PreviewSnapshotCell>
          <DishComparableCell d={section.dish} />
        </PreviewSnapshotCell>
      )
      right = <PreviewEmptyPlaceholderCell text="已移除" />
      break
    case 'dish_changed':
      left = (
        <PreviewSnapshotCell>
          <DishComparableCell d={section.before} />
        </PreviewSnapshotCell>
      )
      right = (
        <PreviewSnapshotCell>
          <DishComparableCell d={section.after} />
        </PreviewSnapshotCell>
      )
      break
  }

  return <PreviewDiffUnitShell label={label} left={left} right={right} />
}
