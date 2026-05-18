import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { createPortal } from 'react-dom'

import { Link, useLocation } from 'react-router-dom'

import { BackHeader } from '@/components/layout/AppLayout'

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
} from '@/features/practice/PracticeRestaurantCard'

import { usePracticeRestaurantCardDisplay } from '@/features/practice/usePracticeRestaurantCardDisplay'
import { PracticeReviewDetailsSection } from './PracticeReviewDetailsSection'

import { usePracticeDraft } from '@/stores/practiceDraft'
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



export function PracticeStep2Page() {

  const location = useLocation()

  const draft = usePracticeDraft()
  const locationPoi = (location.state as { poi?: PoiCandidate } | null)?.poi ?? null
  const backTo =
    typeof (location.state as { from?: string } | null)?.from === 'string'
      ? ((location.state as { from?: string }).from as string)
      : '/practice/step1'

  const display = usePracticeRestaurantCardDisplay()

  const { map: tierCountsMap } = useDisplayedTierMap()

  const consensusQ = useRestaurantPublicTierMode(draft.existing_restaurant_id)

  useEffect(() => {
    if (locationPoi && !draft.selected_poi) {
      draft.setPoi(locationPoi, null, false)
    }
  }, [draft, locationPoi])



  const pendingRef = useRef<HTMLDivElement | null>(null)

  const rowRefs = useRef<Record<Tier, HTMLDivElement | null>>({

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
  const dragPlacementRef = useRef<Tier | null>(null)



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



  if (!display) {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
        <BackHeader title="写评价" backTo="/practice/step1" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-base font-semibold text-neutral-900">还没有选定店铺</p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            先搜索确认一家店，再进入定档和菜品评价。
          </p>
          <Link
            to="/practice/step1"
            className="mt-6 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            去搜索店铺
          </Link>
        </div>
      </div>
    )
  }


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

    dragPlacementRef.current = tier ?? null

    setDragging(true)

  }



  function handleDragMove(e: ReactPointerEvent<HTMLDivElement>) {

    if (!dragActiveRef.current || !dragBaseRectRef.current) return

    const r = dragBaseRectRef.current

    const o = dragOriginRef.current

    const dx = e.clientX - o.x

    const dy = e.clientY - o.y

    const placement = nearestPlacement(e.clientY)

    dragPlacementRef.current = placement



    setDragFloating((prev) =>

      prev

        ? {

            left: r.left + dx,

            top: r.top + dy,

            width: r.width,

            height: r.height,

            tier: placement ?? undefined,

          }

        : null,

    )

  }



  function handleDragEnd(e: ReactPointerEvent<HTMLDivElement>) {

    if (!dragActiveRef.current) return

    const placement = dragPlacementRef.current ?? nearestPlacement(e.clientY)

    dragActiveRef.current = false

    dragBaseRectRef.current = null

    dragPlacementRef.current = null

    draft.setTier(placement)

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

    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">

      <BackHeader title="写评价" backTo={backTo} />




      {dragFloating

        ? createPortal(

            <div

              className={`pointer-events-none h-full ${PRACTICE_DRAG_CARD_OUTER} transition-[top,left,width,height] duration-150 ease-out shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]`}

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
        {/* 区域一：待拖动（独立区块，不与六档共用外框） */}

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
              {draft.tier === null ? (
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

        {/* 区域二：仅六档。左+顶+底封口，横线拉满；右侧不画竖向框线 */}
        <p className="-ml-2 mb-2 w-fit pl-0 text-[11px] font-medium text-neutral-500 sm:-ml-2.5">六档评级</p>

        <div className="border-b-[3px] border-l-[3px] border-t-[3px] border-neutral-950">
          <ul className="flex flex-col divide-y-[3px] divide-solid divide-neutral-950">
            {TIER_ORDER.map((tier) => (
              <li
                key={tier}
                className="grid grid-cols-[20%_1fr] list-none items-stretch gap-0"
              >
                <TierLabelBlock tier={tier} count={countsByTier[tier] ?? 0} />

                <div
                  ref={(el) => {
                    rowRefs.current[tier] = el
                  }}
                  className="relative flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
                >
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


      </section>



      <PracticeReviewDetailsSection />

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
