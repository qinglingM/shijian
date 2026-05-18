import { useLayoutEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { useDishesByRestaurant } from '@/features/dishes/useDishesByRestaurant'
import { completePracticeSubmissionFlow } from '@/features/practice-submit/completePracticeSubmissionFlow'
import { usePracticeRestaurantCardDisplay } from '@/features/practice/usePracticeRestaurantCardDisplay'
import { readImageAsDataUrl } from '@/lib/imageFile'
import { useAuthStore } from '@/stores/authStore'
import {
  everyDishRowHasName,
  everyDishRowHasScore,
  isValidPractice,
  usePracticeDraft,
  type DraftDishReview,
} from '@/stores/practiceDraft'

export function PracticeReviewDetailsSection() {
  const navigate = useNavigate()
  const draft = usePracticeDraft()
  const display = usePracticeRestaurantCardDisplay()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const captureStep3SubmissionBaselineIfNeeded = usePracticeDraft(
    (s) => s.captureStep3SubmissionBaselineIfNeeded,
  )
  const baselineReady = usePracticeDraft((s) => s.submission_baseline !== null)
  const draftTier = usePracticeDraft((s) => s.tier)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useLayoutEffect(() => {
    captureStep3SubmissionBaselineIfNeeded()
  }, [captureStep3SubmissionBaselineIfNeeded, draftTier])

  const { data: existingDishes = [] } = useDishesByRestaurant(draft.existing_restaurant_id)

  const draftDishIds = useMemo(
    () => new Set(draft.dishes.map((d) => d.dish_id).filter(Boolean) as string[]),
    [draft.dishes],
  )

  const selectableExistingDishes = useMemo(() => {
    const seenNames = new Set<string>()
    return existingDishes.filter((dish) => {
      if (draftDishIds.has(dish.id)) return false
      const normalizedName = dish.name.trim().toLocaleLowerCase('zh-CN')
      if (normalizedName === '') return false
      if (seenNames.has(normalizedName)) return false
      seenNames.add(normalizedName)
      return true
    })
  }, [draftDishIds, existingDishes])

  const hasExistingDishChoices = selectableExistingDishes.length > 0
  const allDishesNamed = everyDishRowHasName(draft)
  const allDishesScored = everyDishRowHasScore(draft)
  const canSubmit = isValidPractice(draft)
  const hasDraftDishes = draft.dishes.length > 0
  const primaryCtaLabel = hasDraftDishes ? '鉴定完毕' : '仅鉴定餐厅'

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

  async function handleSubmit() {
    if (!canSubmit || !baselineReady || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await completePracticeSubmissionFlow({
        draft,
        queryClient,
        userId,
        navigate,
        onBeforeReset: () => undefined,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (!display) return null

  return (
    <>
      <section className="flex-1 px-4 pt-5">
        <h2 className="text-sm font-medium text-neutral-800">
          我吃的菜
          <span className="ml-2 text-[11px] text-neutral-400">
            选填 · 不写菜品也可仅鉴定餐厅档位
          </span>
        </h2>

        {draft.existing_restaurant_id && selectableExistingDishes.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-neutral-700">这家店大家还评过</p>
              <span className="text-[11px] text-neutral-400">点选后生成评分卡</span>
            </div>

            <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-1">
              <ul className="flex min-w-full gap-2">
                {selectableExistingDishes.map((dish) => (
                  <li key={dish.id} className="list-none">
                    <button
                      type="button"
                      onClick={() => addExistingDish(dish)}
                      className="flex w-[8.5rem] shrink-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-2.5 py-2 text-left shadow-sm shadow-neutral-900/5 active:bg-neutral-50"
                    >
                      {dish.cover_image_url ? (
                        <img
                          src={dish.cover_image_url}
                          alt={dish.name}
                          className="size-11 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                          <Plus size={16} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {dish.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          {dish.review_count > 0 ? `${dish.review_count} 人评过` : '加入评价'}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {draft.dishes.length === 0 && !hasExistingDishChoices ? (
          <div className="mt-3 space-y-3">
            <DishPlaceholderCard onActivate={addNewDish} />
            <p className="text-center text-xs text-neutral-400">
              不写菜品也可直接点下方按钮「仅鉴定餐厅」
            </p>
          </div>
        ) : draft.dishes.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {draft.dishes.map((d) => (
              <DishItem key={d.client_id} dish={d} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-xs text-neutral-400">
            先从上方挑你吃过的菜；如果没有，再手动新增。
          </p>
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

      <div className="mt-auto px-4 pt-6 pb-4">
        <label className="mb-3 flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={draft.is_anonymous}
            onChange={(e) => draft.setIsAnonymous(e.target.checked)}
            className="size-3.5"
          />
          匿名评价
        </label>
        <button
          type="button"
          disabled={!canSubmit || !baselineReady || submitting}
          onClick={() => void handleSubmit()}
          className={`block w-full rounded-2xl py-3.5 text-center text-sm font-medium ${
            canSubmit && baselineReady && !submitting
              ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-orange-700/25'
              : 'cursor-not-allowed bg-neutral-300 text-neutral-500'
          }`}
        >
          {submitting ? '提交中…' : primaryCtaLabel}
        </button>
        {!canSubmit && (
          <p className="mt-2 text-center text-[11px] text-neutral-400">
            {draft.dishes.length > 0 && !allDishesNamed
              ? '请为每道菜填写菜名，或删除未填写的菜品'
              : draft.dishes.length > 0 && !allDishesScored
                ? '请为每道菜完成评分'
                : '请先为餐厅选定档位'}
          </p>
        )}
        {canSubmit && !baselineReady && (
          <p className="mt-2 text-center text-[11px] text-neutral-400">准备提交数据中…</p>
        )}
        {submitError && (
          <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs leading-5 text-rose-600">
            {submitError}
          </p>
        )}
      </div>
    </>
  )
}

function DishPlaceholderCard({ onActivate }: { onActivate: () => void }) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className="block w-full rounded-2xl border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm text-neutral-400">
          菜名（如 麻辣肥牛）
        </div>

        <span className="rounded-md p-1 text-rose-200" aria-hidden>
          <Trash2 size={14} strokeWidth={2} />
        </span>
      </div>

      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span>0–10 分</span>
          <span className="font-medium text-neutral-500">未评分</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <span
              key={n}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs ${
                SCORE_HEAT_BUTTON[n] ?? SCORE_HEAT_BUTTON[0]
              }`}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs leading-5 text-neutral-400">
        一句锐评（选填）
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <Camera size={14} />
        <span>上传我的图</span>
      </div>
    </button>
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
        {isNew ? (
          <input
            value={dish.name}
            onChange={(e) => updateDish(dish.client_id, { name: e.target.value })}
            placeholder="菜名（如 麻辣肥牛）"
            className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm outline-none"
          />
        ) : (
          <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{dish.name}</p>
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

      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 active:bg-neutral-100">
        {dish.image_url ? (
          <>
            <img
              src={dish.image_url}
              alt={dish.name || '菜品照片'}
              className="size-10 rounded-lg object-cover"
            />
            <span>重新上传我的图</span>
          </>
        ) : (
          <>
            <Camera size={14} />
            <span>上传我的图</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="sr-only"
        />
      </label>
    </li>
  )
}

const SCORE_HEAT_BUTTON = [
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
