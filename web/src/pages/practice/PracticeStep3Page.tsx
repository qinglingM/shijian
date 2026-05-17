import { useEffect, useLayoutEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react'
import { BackHeader, PracticeProgress } from '@/components/layout/AppLayout'
import {
  PracticeRestaurantDragCard,
  PracticeRestaurantDragRow,
} from '@/features/practice/PracticeRestaurantCard'
import { usePracticeRestaurantCardDisplay } from '@/features/practice/usePracticeRestaurantCardDisplay'
import { TIER_LABEL } from '@/lib/db'
import { useDishesByRestaurant } from '@/features/dishes/useDishesByRestaurant'
import { completePracticeSubmissionFlow } from '@/features/practice-submit/completePracticeSubmissionFlow'
import { readImageAsDataUrl } from '@/lib/imageFile'
import { useAuthStore } from '@/stores/authStore'
import {
  everyDishRowHasName,
  isValidPractice,
  usePracticeDraft,
  type DraftDishReview,
} from '@/stores/practiceDraft'
import {
  isPracticeSubmissionDirty,
  snapshotFromDraftLike,
  type PracticeDraftDirtyInput,
} from '@/features/practice/practiceSubmissionBaseline'
import {
  computeModifySections,
} from '@/features/practice/practiceModifyPreview'
import { ModifyPreviewDiffUnit, SubmitFullPreviewContent } from '@/features/practice/ModifyPreviewDiffUnit'

export function PracticeStep3Page() {
  const navigate = useNavigate()
  const draft = usePracticeDraft()
  const display = usePracticeRestaurantCardDisplay()
  const captureStep3SubmissionBaselineIfNeeded = usePracticeDraft(
    (s) => s.captureStep3SubmissionBaselineIfNeeded,
  )

  useLayoutEffect(() => {
    captureStep3SubmissionBaselineIfNeeded()
  }, [captureStep3SubmissionBaselineIfNeeded])

  const baselineReady = usePracticeDraft((s) => s.submission_baseline !== null)
  const submissionDirty = usePracticeDraft((s) =>
    isPracticeSubmissionDirty({
      tier: s.tier,
      store_comment: s.store_comment,
      is_public: s.is_public,
      dishes: s.dishes,
      submission_baseline: s.submission_baseline,
      submission_baseline_practice_public_snapshot: s.submission_baseline_practice_public_snapshot,
    }),
  )

  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitPreviewVariant, setSubmitPreviewVariant] = useState<'modify' | 'submit_full'>(
    'submit_full',
  )
  const [noChangeConfirmOpen, setNoChangeConfirmOpen] = useState(false)

  useEffect(() => {
    if (!display) navigate('/practice/step1', { replace: true })
    else if (!draft.tier) navigate('/practice/step2', { replace: true })
  }, [display, draft.tier, navigate])

  const { data: existingDishes = [] } = useDishesByRestaurant(
    draft.existing_restaurant_id,
  )

  const draftDishIds = useMemo(
    () => new Set(draft.dishes.map((d) => d.dish_id).filter(Boolean) as string[]),
    [draft.dishes],
  )

  const unaddedExisting = existingDishes.filter((d) => !draftDishIds.has(d.id))

  function addExistingDish(dish: { id: string; name: string }) {
    draft.addDish({
      dish_id: dish.id,
      name: dish.name,
      score: null,
      comment: '',
      image_url: null,
      is_public: true,
    })
  }

  function addNewDish() {
    draft.addDish({
      dish_id: null,
      name: '',
      score: null,
      comment: '',
      image_url: null,
      is_public: true,
    })
  }

  const allDishesNamed = everyDishRowHasName(draft)

  const canSubmit = isValidPractice(draft)

  const hasDraftDishes = draft.dishes.length > 0

  const isExistingPracticeUpdate =
    draft.will_replace_existing_practice && draft.submission_baseline_locked_from_server

  const primaryCtaLabel = !baselineReady
    ? hasDraftDishes
      ? '鉴定完毕'
      : '仅鉴定餐厅'
    : submissionDirty
      ? isExistingPracticeUpdate
        ? '提交修改'
        : '提交'
      : hasDraftDishes
        ? '鉴定完毕'
        : '仅鉴定餐厅'

  function handlePrimaryClick() {
    if (!canSubmit || !baselineReady) return

    if (submissionDirty) {
      setSubmitPreviewVariant(isExistingPracticeUpdate ? 'modify' : 'submit_full')
      setSubmitOpen(true)
      return
    }

    // 本地基线仅是进第三步时的快照，不代表「已与服务器存档一致」；首次提交应直接走提交预览
    if (!isExistingPracticeUpdate) {
      setSubmitPreviewVariant('submit_full')
      setSubmitOpen(true)
      return
    }

    setNoChangeConfirmOpen(true)
  }

  if (!display) return null

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col pb-4">
      <BackHeader title="补上我吃的菜" backTo="/practice/step2" />
      <PracticeProgress current={3} />

      {/* 当前店：左对齐占满行宽，右侧圆形铅笔改档 */}
      <section className="pl-4 pr-2 pt-3 sm:pr-3">
        <div className="flex w-full min-w-0 items-center gap-2">
          <PracticeRestaurantDragRow fullWidth>
            <PracticeRestaurantDragCard
              display={display}
              tier={draft.tier ?? undefined}
              badge={TIER_LABEL[draft.tier!]}
            />
          </PracticeRestaurantDragRow>
          <button
            type="button"
            onClick={() => navigate('/practice/step2')}
            aria-label="修改档位"
            title="修改档位"
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-orange-200/90 bg-white text-orange-600 shadow-md shadow-orange-900/10 active:bg-orange-50"
          >
            <Pencil size={18} strokeWidth={2.25} />
          </button>
        </div>
      </section>

      {/* 已有菜品（仅命中库的店铺） */}
      {draft.existing_restaurant_id && unaddedExisting.length > 0 && (
        <section className="px-4 pt-5">
          <h2 className="text-sm font-medium text-neutral-800">
            这家店的菜品
            <span className="ml-2 text-[11px] text-neutral-400">点击添加到你的评价</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unaddedExisting.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => addExistingDish(d)}
                  className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700 active:bg-neutral-200"
                >
                  <Plus size={11} />
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 我吃的菜（草稿） */}
      <section className="flex-1 px-4 pt-5">
        <h2 className="text-sm font-medium text-neutral-800">
          我吃的菜
          <span className="ml-2 text-[11px] text-neutral-400">
            选填 · 不写菜品也可仅鉴定餐厅档位
          </span>
        </h2>

        {draft.dishes.length === 0 ? (
          <p className="mt-4 py-6 text-center text-xs text-neutral-400">
            还没有添加菜品 · 可直接点下方按钮「仅鉴定餐厅」，或新增菜品后再提交
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {draft.dishes.map((d) => (
              <DishItem key={d.client_id} dish={d} />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={addNewDish}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-600 active:bg-neutral-50"
        >
          <Plus size={14} />
          新增菜品
        </button>
      </section>

      {/* 鉴定完毕 / 提交修改 */}
      <div className="px-4 pt-6 pb-4">
        <button
          type="button"
          disabled={!canSubmit || !baselineReady}
          onClick={handlePrimaryClick}
          className={`block w-full rounded-2xl py-3.5 text-center text-sm font-medium ${
            canSubmit && baselineReady
              ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-orange-700/25'
              : 'cursor-not-allowed bg-neutral-300 text-neutral-500'
          }`}
        >
          {primaryCtaLabel}
        </button>
        {!canSubmit && (
          <p className="mt-2 text-center text-[11px] text-neutral-400">
            {draft.dishes.length > 0 && !allDishesNamed
              ? '请为每道菜填写菜名，或删除未填写的菜品'
              : '请先在第二步为餐厅选定档位'}
          </p>
        )}
        {canSubmit && !baselineReady && (
          <p className="mt-2 text-center text-[11px] text-neutral-400">准备提交数据中…</p>
        )}
      </div>

      {noChangeConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-change-hint-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8"
          onClick={() => setNoChangeConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-100 bg-white px-4 py-4 shadow-xl ring-1 ring-black/8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="no-change-hint-title"
              className="text-center text-base font-semibold text-neutral-900"
            >
              暂未发生任何修改
            </h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-neutral-600">
              档位、整店评价或菜品与当前存档一致。请先做出适当修改后再提交。
            </p>
            <button
              type="button"
              onClick={() => setNoChangeConfirmOpen(false)}
              className="mt-5 w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-800 active:bg-neutral-200/90"
            >
              返回
            </button>
          </div>
        </div>
      )}

      {submitOpen && (
        <SubmitPreview
          variant={submitPreviewVariant}
          onClose={() => {
            setSubmitOpen(false)
            setSubmitPreviewVariant('submit_full')
          }}
        />
      )}
    </div>
  )
}

function DishItem({ dish }: { dish: DraftDishReview }) {
  const updateDish = usePracticeDraft((s) => s.updateDish)
  const removeDish = usePracticeDraft((s) => s.removeDish)
  const isNew = dish.dish_id === null

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    updateDish(dish.client_id, { image_url: await readImageAsDataUrl(file) })
    e.target.value = ''
  }

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <label className="flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-neutral-100 text-neutral-400">
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name || '菜品照片'} className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[10px]">
              <Camera size={16} />
              传图
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>

        {isNew ? (
          <input
            value={dish.name}
            onChange={(e) => updateDish(dish.client_id, { name: e.target.value })}
            placeholder="菜名（如 麻辣肥牛）"
            className="flex-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm outline-none"
          />
        ) : (
          <p className="flex-1 text-sm font-medium text-neutral-900">{dish.name}</p>
        )}
        <button
          type="button"
          aria-label="移除"
          onClick={() => removeDish(dish.client_id)}
          className="rounded-md p-1 text-rose-400/85 transition-colors hover:bg-rose-50 hover:text-rose-500 active:bg-rose-100/70 active:text-rose-600"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      <ScorePicker
        value={dish.score}
        onChange={(score) => updateDish(dish.client_id, { score })}
      />

      <textarea
        value={dish.comment}
        onChange={(e) => updateDish(dish.client_id, { comment: e.target.value })}
        placeholder="一句锐评（选填）"
        rows={1}
        className="mt-2 w-full resize-none rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs leading-5 outline-none"
      />
    </li>
  )
}

/** 0–10 分：浅白 → rose 逐级加深 → 末尾纯红；避免 4/5/6 因 red-200 反比 rose-300 更浅 */
const SCORE_HEAT_BUTTON =
  [
    'bg-white text-neutral-700 shadow-sm shadow-neutral-900/8',
    'bg-rose-50 text-neutral-800',
    'bg-rose-100 text-neutral-900',
    'bg-rose-200 text-red-950',
    'bg-rose-300 text-red-950',
    'bg-rose-400 text-red-950',
    'bg-rose-500 text-white',
    'bg-rose-600 text-white',
    'bg-red-500 text-white',
    'bg-red-600 text-white',
    'bg-red-700 text-white',
  ] as const

function ScorePicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (score: number | null) => void
}) {
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>0–10 分</span>
        <span
          className={
            value === null
              ? 'font-medium text-neutral-500'
              : 'font-semibold text-red-600'
          }
        >
          {value === null ? '未评分' : `${value} 分`}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const active = value === n
          const heat = SCORE_HEAT_BUTTON[n] ?? SCORE_HEAT_BUTTON[0]
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} 分`}
              data-testid={`score-${n}`}
              onClick={() => onChange(active ? null : n)}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-transform ${
                heat
              } ${active ? 'z-10 scale-105 ring-2 ring-orange-500 ring-offset-1' : 'active:opacity-90'}`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SubmitPreview({
  variant,
  onClose,
}: {
  variant: 'modify' | 'submit_full'
  onClose: () => void
}) {
  const draft = usePracticeDraft()
  const display = usePracticeRestaurantCardDisplay()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const title = variant === 'modify' ? '修改预览' : '提交预览'

  const baselinePracticePublic =
    draft.submission_baseline_practice_public_snapshot ?? draft.is_public

  const dirtyInput: PracticeDraftDirtyInput = {
    tier: draft.tier,
    store_comment: draft.store_comment,
    is_public: draft.is_public,
    dishes: draft.dishes,
    submission_baseline: draft.submission_baseline,
    submission_baseline_practice_public_snapshot: draft.submission_baseline_practice_public_snapshot,
  }

  const currentSnap =
    draft.tier != null ? snapshotFromDraftLike(dirtyInput) : null

  const modifySections =
    variant === 'modify' && draft.submission_baseline && currentSnap
      ? computeModifySections(
          draft.submission_baseline,
          currentSnap,
          baselinePracticePublic,
          draft.is_public,
        )
      : []

  const subtitle =
    variant === 'submit_full' ? '确认后将正式提交以下内容。' : null

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await completePracticeSubmissionFlow({
        draft,
        queryClient,
        userId,
        navigate,
        onBeforeReset: onClose,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-preview-title"
      className="fixed inset-0 z-30 overflow-y-auto bg-black/45"
      onClick={onClose}
    >
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-4 py-6">
        <div
          className={`w-full rounded-2xl bg-white shadow-xl ring-1 ring-black/10 ${
            variant === 'submit_full'
              ? 'max-w-sm px-3 py-3'
              : 'max-w-sm px-4 py-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        <h2
          id="practice-preview-title"
          className={`text-base font-semibold text-neutral-900 ${
            variant === 'modify' || variant === 'submit_full' ? 'text-center' : ''
          }`}
        >
          {title}
        </h2>
        {subtitle != null ? (
          <p
            className={`mt-1 leading-relaxed text-neutral-500 text-center text-sm`}
          >
            {subtitle}
          </p>
        ) : null}

        {variant === 'modify' && (
          <div className="mt-3 space-y-2.5">
            {modifySections.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-6 text-center text-[11px] text-neutral-500">
                未解析到差异化条目（仍可确认提交）。
              </p>
            ) : (
              modifySections.map((sec, idx) => (
                <ModifyPreviewDiffUnit key={`${idx}-${sec.kind}`} section={sec} />
              ))
            )}
          </div>
        )}

        {variant === 'submit_full' && (
          <SubmitFullPreviewContent
            brandName={display?.brand_name}
            restaurantImageUrl={display?.cover_image_url}
            tier={draft.tier}
            isPublic={draft.is_public}
            storeComment={draft.store_comment}
            dishes={draft.dishes}
          />
        )}

        {submitError && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-600">
            {submitError}
          </p>
        )}

        <div className={`flex gap-2 ${variant === 'submit_full' ? 'mt-4' : 'mt-5'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700"
          >
            返回继续编辑
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3 text-sm font-medium text-white shadow-md shadow-orange-700/25 disabled:opacity-55"
          >
            {submitting ? '提交中…' : '确认提交'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
