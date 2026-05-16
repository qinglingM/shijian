import type { CSSProperties, ReactNode } from 'react'
import { RestaurantNameGlyphCover } from '@/features/practice/RestaurantNameGlyphCover'
import type { Tier } from '@/lib/db'
import { TIER_SLOT_VAR } from '@/lib/db'
import type { PoiCandidate } from '@/lib/poi/types'
import { cn } from '@/lib/utils'

/**
 * 定档页（第二步）`section px-4` 内可用宽度：主栏 `max-w-md`（28rem），左右各减去 1rem。
 * 与 `AppLayout` 顶栏一致；若改版宽须与此同步。
 */
export const PRACTICE_STEP_INNER_WIDTH_CALC = 'min(100vw, 28rem) - 2rem'

/**
 * 定档网格 `grid-cols-[20%_1fr]` 下右侧店卡外包矩形尺寸（与左侧 20% 列 `aspect-square` 决定的行高一致）：
 * - 宽 = inner × **0.8**
 * - 高 = inner × **0.2**
 *
 * 数值示例（1rem = 16px，inner = min(视口,448px) − 32）：
 * | 视口宽 | inner | 店卡宽×高 (px) |
 * |-------|-------|----------------|
 * | 360 | 328 | **262.4 × 65.6** |
 * | 390 | 358 | **286.4 × 71.68** |
 * | ≥448（栏顶满 max-w-md） | 416 | **332.8 × 83.2** |
 */
export const PRACTICE_TIER_DRAG_CARD_WIDTH_CALC = `calc((${PRACTICE_STEP_INNER_WIDTH_CALC}) * 0.8)`
export const PRACTICE_TIER_DRAG_CARD_HEIGHT_CALC = `calc((${PRACTICE_STEP_INNER_WIDTH_CALC}) * 0.2)`

export function practiceTierDragCardBoxStyle(): CSSProperties {
  return {
    width: PRACTICE_TIER_DRAG_CARD_WIDTH_CALC,
    height: PRACTICE_TIER_DRAG_CARD_HEIGHT_CALC,
  }
}

/** 与定档拖动区一致的店卡外框（搜店列表、第三步摘要亦用之） */
export const PRACTICE_RESTAURANT_CARD_FRAME =
  'overflow-hidden rounded-lg border border-neutral-950/20 bg-white shadow-sm ring-1 ring-neutral-950/15'

/**
 * 第二步「拖动」槽内外层：与 `RestaurantDragSurface` 根节点 class 完全一致（仅不含指针/抓取态）。
 */
export const PRACTICE_DRAG_CARD_OUTER = cn(
  'relative z-10 flex min-h-0 w-full min-w-0 flex-1 overflow-hidden',
  PRACTICE_RESTAURANT_CARD_FRAME,
)

export type PracticeRestaurantCardDisplay = {
  brand_name: string
  address_text: string | null
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
}

export function practiceDisplayFromPoiCandidate(poi: PoiCandidate): PracticeRestaurantCardDisplay {
  return {
    brand_name: poi.poi_name,
    address_text: poi.address_text,
    city_name: poi.city_name,
    district_name: poi.district_name,
    cover_image_url: poi.cover_image_url ?? null,
  }
}

type PracticeRestaurantCardProps = {
  display: PracticeRestaurantCardDisplay
  /** 无封面图时左侧色块；搜店阶段不传 */
  tier?: Tier
  /** 不传则不显示角标（第一步仅占位图+文案） */
  badge?: string
  /** 定档格内铺满；搜店/摘要区用固定最小高度 */
  fillContainer?: boolean
  className?: string
}

/**
 * 练习流程三步共用的餐厅信息条：左图/占位色 + 店名 + 角标 + 地址行。
 * 视觉以第二步「拖动评级」槽内样式为准。
 */
export function PracticeRestaurantCard({
  display,
  tier,
  badge,
  fillContainer = true,
  className,
}: PracticeRestaurantCardProps) {
  const fill = tier ? TIER_SLOT_VAR[tier] : '#f5f5f4'
  const placeLine =
    [display.city_name, display.district_name].filter(Boolean).join(' ').trim() ||
    display.address_text?.trim() ||
    null

  return (
    <div
      className={cn(
        'pointer-events-none flex w-full items-stretch bg-white',
        fillContainer ? 'h-full min-h-0 flex-1 rounded-[inherit]' : 'min-h-[3.25rem]',
        className,
      )}
    >
      <div className="relative h-full min-h-0 w-[4.5rem] shrink-0 overflow-hidden sm:w-20">
        {display.cover_image_url ? (
          <img
            src={display.cover_image_url}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <div
            className="flex size-full min-h-0 items-center justify-center px-0.5"
            style={{ background: fill }}
            aria-hidden="true"
          >
            <RestaurantNameGlyphCover
              name={display.brand_name}
              tier={tier ?? null}
              density="practice"
            />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-neutral-900">
            {display.brand_name}
          </p>
          {badge ? (
            <span className="shrink-0 rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-900 ring-1 ring-orange-100">
              {badge}
            </span>
          ) : null}
        </div>
        {placeLine ? (
          <p className="line-clamp-2 text-[10px] leading-snug text-neutral-500">{placeLine}</p>
        ) : (
          <p className="text-[10px] text-neutral-400">暂无城市/地址展示</p>
        )}
      </div>

      <span className="sr-only">{display.brand_name}</span>
    </div>
  )
}

/** 与第二步拖动槽内「整张卡片」同构：外层 + `PracticeRestaurantCard` 铺满 */
export function PracticeRestaurantDragCard({
  display,
  tier,
  badge,
  className,
}: {
  display: PracticeRestaurantCardDisplay
  tier?: Tier
  badge?: string
  className?: string
}) {
  return (
    <div className={cn(PRACTICE_DRAG_CARD_OUTER, className)}>
      <PracticeRestaurantCard display={display} tier={tier} badge={badge} fillContainer />
    </div>
  )
}

/**
 * 与第二步定档页同一行几何：左侧 20% 透明方块决定行高（= 右侧店卡高度），右侧即槽内那张可拖动卡片。
 *
 * `fullWidth`：搜店第一步 / 第三步摘要等处不与左侧「定档格」并排时，去掉 20% 占位；
 * 卡片外包矩形仍用 `PRACTICE_TIER_DRAG_CARD_WIDTH_CALC` × `PRACTICE_TIER_DRAG_CARD_HEIGHT_CALC`（与定档右侧槽完全一致）。
 */
export function PracticeRestaurantDragRow({
  children,
  fullWidth = false,
}: {
  children: ReactNode
  /** 为 true 时使用与定档页相同的 calc 宽高，不占伪 20% 列 */
  fullWidth?: boolean
}) {
  if (fullWidth) {
    return (
      <div
        className="min-w-0 shrink-0"
        style={practiceTierDragCardBoxStyle()}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="grid w-full max-w-full grid-cols-[20%_1fr] items-stretch gap-0">
      <div className="aspect-square w-full min-w-0 bg-transparent" aria-hidden />
      <div className="relative flex min-h-0 min-w-0 flex-col self-stretch">{children}</div>
    </div>
  )
}
