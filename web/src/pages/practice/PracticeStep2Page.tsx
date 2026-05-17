import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Camera, Pencil, Plus, Trash2 } from 'lucide-react'
import { BackHeader, PracticeProgress } from '@/components/layout/AppLayout'
import { useQueryClient } from '@tanstack/react-query'
import {
  TIER_COLOR_VAR,
  TIER_LABEL,
  TIER_ORDER,
  type Tier,
} from '@/lib/db'
import { useRestaurantPublicTierMode } from '@/features/restaurants/useRestaurantPublicTierMode'
import { TierLabelBlock } from '@/features/tier-map/TierLabelBlock'
import { useDisplayedTierMap } from '@/features/tier-map/useTierMap'
import {
  PracticeRestaurantCard,
  PRACTICE_DRAG_CARD_OUTER,
  type PracticeRestaurantCardDisplay,
  PracticeRestaurantDragCard,
  PracticeRestaurantDragRow,
} from '@/features/practice/PracticeRestaurantCard'
import { usePracticeRestaurantCardDisplay } from '@/features/practice/usePracticeRestaurantCardDisplay'
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
import type { PoiCandidate } from '@/lib/poi/types'

/** 一句整店锐评：仅作输入框 placeholder（按档位） */
const STORE_REVIEW_PLACEHOLDER: Record<Tier, string> = {
  boom: '选择夯爆了的时候：把盘子通通给我舔干净！',
  hang: '选择夯的时候说：好吃到抽耳光都不放手！',
  top: '顶级的话就是：永远我心中的白月光。',
  upper: '人上人的就是：至少不是一个错误的选择。',
  npc: 'NPC就是：至少没浪费。',
  bad: '拉完了就是：说好吃的拉出去斩了。',
}

type DragFloating = {
  left: number
  top: number
  width: number
  height: number
  tier?: Tier
}

export function PracticeStep2Page({ defaultTab = 'tier' }: { defaultTab?: 'tier' | 'dishes' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const draft = usePracticeDraft()
  const locationPoi = (location.state as { poi?: PoiCandidate } | null)?.poi ?? null

  const display = usePracticeRestaurantCardDisplay()
  const { map: tierCountsMap } = useDisplayedTierMap()
  const consensusQ = useRestaurantPublicTierMode(draft.existing_restaurant_id)

  const initialTab = (location.state as { tab?: 'tier' | 'dishes' } | null)?.tab ?? defaultTab
  const [activeTab, setActiveTab] = useState<'tier' | 'dishes'>(initialTab)

  // Step 3 layout baseline queries
  const captureStep3SubmissionBaselineIfNeeded = usePracticeDraft(
    (s) => s.captureStep3SubmissionBaselineIfNeeded,
  )

  useLayoutEffect(() => {
    if (activeTab === 'dishes') {
      captureStep3SubmissionBaselineIfNeeded()
    }
  }, [captureStep3SubmissionBaselineIfNeeded, activeTab])

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

  const primaryCtaLabel = !baselineReady
    ? hasDraftDishes
      ? '鉴定完毕'
      : '仅鉴定餐厅'
    : submissionDirty
      ? draft.submission_baseline_locked_from_server
        ? '提交修改'
        : '提交'
      : hasDraftDishes
        ? '鉴定完毕'
        : '仅鉴定餐厅'

  function handlePrimaryClick() {
    if (!canSubmit || !baselineReady) return

    const baselineFromServer = draft.submission_baseline_locked_from_server

    if (submissionDirty) {
      setSubmitPreviewVariant(baselineFromServer ? 'modify' : 'submit_full')
      setSubmitOpen(true)
      return
    }

    if (!baselineFromServer) {
      setSubmitPreviewVariant('submit_full')
      setSubmitOpen(true)
      return
    }

    setNoChangeConfirmOpen(true)
  }

  useEffect(() => {
    if (locationPoi && !draft.selected_poi) {
      draft.setPoi(locationPoi, null, false)
    }
  }, [draft, locationPoi])

  const pendingRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Record<Tier, HTMLLIElement | null>>({
    boom: null,
    hang: null,
    top: null,
    upper: null,
    npc: null,
    bad: null,
  })

  const dragOriginRef = useRef({ x: 0, y: 0 })
  const dragBaseRectRef = useRef<DOMRect | null>(null)
  const dragActiveRef = useRef(false)

  const [dragFloating, setDragFloating] = useState<DragFloating | null>(null)
  const [dragging, setDragging] = useState(false)

  const tierForPendingOutline =
    !draft.existing_restaurant_id ||
    consensusQ.isPending ||
    consensusQ.isError
      ? null
      : consensusQ.data

  const pendingOutline =
    tierForPendingOutline != null
      ? tierForPendingOutline === 'bad'
        ? '#404040'
        : TIER_COLOR_VAR[tierForPendingOutline]
      : '#d4d4d4'

  const countsByTier = Object.fromEntries(
    tierCountsMap.buckets.map((b) => [b.tier, b.restaurants.length]),
  ) as Record<Tier, number>

  useEffect(() => {
    if (!display) navigate('/practice/step1', { replace: true })
  }, [display, navigate])

  if (!display) return null

  function nearestPlacement(clientY: number): Tier | null {
    let nearest: Tier | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    const pendingRect = pendingRef.current?.getBoundingClientRect()

    if (pendingRect) {
      const center = pendingRect.top + pendingRect.height / 2
      nearestDistance = Math.abs(clientY - center)
    }

    for (const tier of TIER_ORDER) {
      const rect = rowRefs.current[tier]?.getBoundingClientRect()
      if (!rect) continue

      const center = rect.top + rect.height / 2
      const distance = Math.abs(clientY - center)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = tier
      }
    }

    return nearest
  }

  function readDragTier(target: HTMLElement): Tier | undefined {
    const raw = target.getAttribute('data-drag-tier')
    if (!raw) return undefined
    if (TIER_ORDER.includes(raw as Tier)) return raw as Tier
    return undefined
  }

  function handleDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    dragActiveRef.current = true
    dragOriginRef.current = { x: e.clientX, y: e.clientY }

    const rect = el.getBoundingClientRect()
    dragBaseRectRef.current = rect
    const tier = readDragTier(el)

    setDragFloating({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      tier,
    })
    setDragging(true)
  }

  function handleDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragActiveRef.current || !dragBaseRectRef.current) return
    const r = dragBaseRectRef.current
    const o = dragOriginRef.current
    const dx = e.clientX - o.x
    const dy = e.clientY - o.y

    setDragFloating((prev) =>
      prev
        ? {
            ...prev,
            left: r.left + dx,
            top: r.top + dy,
          }
        : null,
    )
  }

  function handleDragEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragActiveRef.current) return
    dragActiveRef.current = false
    dragBaseRectRef.current = null
    draft.setTier(nearestPlacement(e.clientY))
    setDragging(false)
    setDragFloating(null)

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* 部分环境下可能已释放 */
    }
  }

  const dragCallbacks = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white pb-6">
      <BackHeader title="放进食鉴图" backTo="/practice/step1" />

      {/* 极简精致的选项卡页签 */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex rounded-xl bg-neutral-100 p-1 ring-1 ring-black/[0.03]">
          <button
            type="button"
            onClick={() => setActiveTab('tier')}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all duration-200 ${
              activeTab === 'tier'
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/[0.04]'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            1. 鉴定餐厅
          </button>
          <button
            type="button"
            onClick={() => {
              if (draft.tier) setActiveTab('dishes')
            }}
            disabled={!draft.tier}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all duration-200 ${
              activeTab === 'dishes'
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/[0.04]'
                : !draft.tier
                  ? 'cursor-not-allowed text-neutral-400 opacity-60'
                  : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            2. 补上菜品
          </button>
        </div>
      </div>

      <PracticeProgress current={activeTab === 'tier' ? 2 : 3} />

      {activeTab === 'tier' ? (
        /* STEP 2 CONTENT (Restaurant Evaluation) */
        <div className="flex flex-1 flex-col">
          {dragFloating
            ? createPortal(
                <div
                  className={`pointer-events-none h-full ${PRACTICE_DRAG_CARD_OUTER} shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]`}
                  style={{
                    position: 'fixed',
                    left: dragFloating.left,
                    top: dragFloating.top,
                    width: dragFloating.width,
                    height: dragFloating.height,
                    zIndex: 10050,
                    boxSizing: 'border-box',
                  }}
                >
                  <PracticeRestaurantCard
                    display={display}
                    tier={dragFloating.tier}
                    badge={
                      dragFloating.tier ? TIER_LABEL[dragFloating.tier] : '待摆放'
                    }
                  />
                </div>,
                document.body,
              )
            : null}

          <section className="px-4 pt-4">
            <div className="mb-3 rounded-xl border border-neutral-900/18 bg-neutral-50/40 px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-sm font-medium text-neutral-800">食鉴档位</h2>
                <span
                  className={`shrink-0 text-[11px] ${
                    draft.tier ? 'font-semibold text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  {draft.tier ? `已选：${TIER_LABEL[draft.tier]}` : '从上方待拖动区域拖入下方六档'}
                </span>
              </div>
            </div>

            {/* 区域一：待拖动 */}
            <div className="mb-5">
              <p className="mb-2 text-[11px] font-medium text-neutral-500">待拖动区域</p>
              <div className="grid grid-cols-[20%_1fr] items-stretch gap-0">
                <div className="flex aspect-square w-full flex-col items-center justify-center overflow-hidden bg-neutral-100 p-1 ring-1 ring-black/8">
                  <span className="flex flex-col items-center text-center font-bold leading-[1.12] text-neutral-800">
                    <span className="block text-[clamp(12px,3.4vw,16px)] tracking-tight">拖动</span>
                    <span className="mt-0.5 block text-[clamp(12px,3.4vw,16px)] tracking-tight">评级</span>
                  </span>
                </div>

                <div
                  ref={pendingRef}
                  className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-white ${
                    draft.tier ? 'bg-orange-50/40' : ''
                  }`}
                  style={{
                    outline: `2px solid ${pendingOutline}`,
                    outlineOffset: '-1px',
                  }}
                >
                  {!draft.tier ? (
                    <RestaurantDragSurface
                      display={display}
                      dragging={dragging}
                      {...dragCallbacks}
                    />
                  ) : (
                    <div
                      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 py-2 text-center"
                      aria-hidden
                    >
                      <p className="text-[11px] font-semibold leading-snug text-orange-950">
                        取消「{TIER_LABEL[draft.tier]}」
                      </p>
                      <p className="text-[10px] leading-snug text-orange-800/95">
                        按住下方档位里的<strong className="font-bold">店卡</strong>
                        拖回<strong className="font-bold">待拖动区域</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 区域二：六档 */}
            <p className="-ml-2 mb-2 w-fit pl-0 text-[11px] font-medium text-neutral-500 sm:-ml-2.5">六档评级</p>
            <div className="border-b-[3px] border-l-[3px] border-t-[3px] border-neutral-950">
              <ul className="flex flex-col divide-y-[3px] divide-solid divide-neutral-950">
                {TIER_ORDER.map((tier) => (
                  <li
                    key={tier}
                    ref={(el) => {
                      rowRefs.current[tier] = el
                    }}
                    className="grid grid-cols-[20%_1fr] list-none items-stretch gap-0"
                  >
                    <TierLabelBlock tier={tier} count={countsByTier[tier] ?? 0} />
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch">
                      {draft.tier === tier ? (
                        <RestaurantDragSurface
                          display={display}
                          dragging={dragging}
                          tier={tier}
                          {...dragCallbacks}
                        />
                      ) : (
                        <div className="min-h-0 flex-1 bg-neutral-50/20" aria-hidden />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 text-[11px] leading-snug text-neutral-500">
              {!draft.tier ? (
                <span>
                  从待拖动区域把店卡拖进下方六档；松手时纵向靠近哪一档即选哪档。
                  {!draft.existing_restaurant_id
                    ? ' 新店暂无公开档位统计，边框为占位灰线。'
                    : ''}
                </span>
              ) : (
                <span>店卡在所选档位一行；松开时靠近待拖动区域可取消档位。</span>
              )}
            </div>
          </section>

          <section className="px-4 pt-6">
            <h2 className="text-sm font-medium text-neutral-800">
              一句整店锐评 <span className="text-[11px] text-neutral-400">选填</span>
            </h2>
            <input
              type="text"
              value={draft.store_comment}
              onChange={(e) => draft.setStoreComment(e.target.value)}
              placeholder={
                draft.tier
                  ? STORE_REVIEW_PLACEHOLDER[draft.tier]
                  : '先拖卡片选定档，狠话模版会跟着档位来。'
              }
              className="mt-2 h-8 w-full rounded-full border-0 bg-neutral-100 px-3.5 text-sm leading-8 text-neutral-900 outline-none ring-orange-400/0 placeholder:text-neutral-400 focus-visible:bg-neutral-200/80 focus-visible:ring-2 focus-visible:ring-orange-400/30"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={draft.is_public}
                onChange={(e) => draft.setIsPublic(e.target.checked)}
                className="size-3.5"
              />
              公开评价（其他用户可见）
            </label>
          </section>

          <div className="mt-auto px-4 pt-8">
            <button
              type="button"
              disabled={!draft.tier}
              onClick={() => {
                if (draft.tier) setActiveTab('dishes')
              }}
              className={`flex w-full items-center justify-center gap-1 rounded-2xl py-3.5 text-sm font-medium transition-all ${
                draft.tier
                  ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-orange-700/25 active:opacity-95'
                  : 'cursor-not-allowed bg-neutral-200 text-neutral-400'
              }`}
            >
              {draft.tier ? '下一步：补上我吃的菜' : '请先选择一个档位'}
              {draft.tier && <ChevronRight size={14} />}
            </button>
            <p className="mt-2 text-center text-[11px] text-neutral-400">
              订档即完成有效食鉴的最小单元；下一步可补写菜品，也可仅提交餐厅鉴定
            </p>
          </div>
        </div>
      ) : (
        /* STEP 3 CONTENT (Dish Evaluation) */
        <div className="flex flex-1 flex-col">
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
                onClick={() => setActiveTab('tier')}
                aria-label="修改档位"
                title="修改档位"
                className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-orange-200/90 bg-white text-orange-600 shadow-md shadow-orange-900/10 active:bg-orange-50"
              >
                <Pencil size={18} strokeWidth={2.25} />
              </button>
            </div>
          </section>

          {/* 已有菜品 */}
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

          {/* 我吃的菜 */}
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

          {/* 提交区域 */}
          <div className="px-4 pt-6">
            <button
              type="button"
              disabled={!canSubmit || !baselineReady}
              onClick={handlePrimaryClick}
              className={`block w-full rounded-2xl py-3.5 text-center text-sm font-medium transition-all ${
                canSubmit && baselineReady
                  ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-orange-700/25 active:opacity-95'
                  : 'cursor-not-allowed bg-neutral-300 text-neutral-500'
              }`}
            >
              {primaryCtaLabel}
            </button>
            {!canSubmit && (
              <p className="mt-2 text-center text-[11px] text-neutral-400">
                {draft.dishes.length > 0 && !allDishesNamed
                  ? '请为每道菜填写菜名，或删除未填写的菜品'
                  : '请先在步骤一中选择餐厅档位'}
              </p>
            )}
            {canSubmit && !baselineReady && (
              <p className="mt-2 text-center text-[11px] text-neutral-400">准备提交数据中…</p>
            )}
          </div>
        </div>
      )}

      {/* 弹窗部分 */}
      {noChangeConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-change-hint-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 py-8"
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

function RestaurantDragSurface({
  display,
  dragging,
  tier,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  display: PracticeRestaurantCardDisplay
  dragging: boolean
  tier?: Tier
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const statusText = tier ? TIER_LABEL[tier] : '待摆放'
  const ariaHint = tier
    ? `拖动餐厅信息卡调整档位，当前在${TIER_LABEL[tier]}`
    : '拖动餐厅信息卡选择档位'

  return (
    <div
      role="button"
      aria-label={ariaHint}
      tabIndex={0}
      data-drag-tier={tier ?? ''}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`${PRACTICE_DRAG_CARD_OUTER} touch-none select-none ${dragging ? 'opacity-0' : ''} cursor-grab active:cursor-grabbing`}
    >
      <PracticeRestaurantCard
        display={display}
        tier={tier}
        badge={statusText}
      />
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
            className="flex-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm outline-none ring-1 ring-black/5"
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
      className="fixed inset-0 z-[20000] overflow-y-auto bg-black/45"
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
            <p className={`mt-1 leading-relaxed text-neutral-500 text-center text-sm`}>
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
