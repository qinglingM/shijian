import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { RestaurantNameGlyphCover } from '@/features/practice/RestaurantNameGlyphCover'
import { TierLabelBlock } from '@/features/tier-map/TierLabelBlock'
import { TIER_LABEL, TIER_SLOT_VAR, type Tier } from '@/lib/db'
import type { TierMapItem } from '@/features/tier-map/useTierMap'

const MAX_SLOTS = 4

interface TierRowProps {
  tier: Tier
  count: number
  restaurants: TierMapItem[]
  /** 分类筛选等场景下隐藏「+」添加位，避免与真实占位数量不一致 */
  showAddSlots?: boolean
}

export function TierRow({
  tier,
  count,
  restaurants,
  showAddSlots = true,
}: TierRowProps) {
  const filled = Math.min(restaurants.length, MAX_SLOTS)
  const showAddAt = showAddSlots && count < MAX_SLOTS ? filled : -1
  const slotCount = Math.max(MAX_SLOTS, restaurants.length, showAddAt + 1)
  const slots = Array.from({ length: slotCount }, (_, i) => i)

  /** 仅「无封面图」店铺格：0.5px 细边框（不改变有图格与空白格） */
  const borderNoCover = 'box-border border-[0.5px] border-solid border-neutral-400/75'

  return (
    <div className="grid grid-cols-[20%_1fr] items-start gap-0">
      <TierLabelBlock tier={tier} count={count} href={`/tiers/${tier}`} />

      {/* 单档位横向浏览轨道 */}
      <div className="flex overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slots.map((i) => {
          const restaurant = restaurants[i]
          if (restaurant) {
            return (
              <Link
                key={i}
                to={`/restaurants/${restaurant.id}`}
                className={`group relative flex aspect-square basis-1/4 shrink-0 overflow-hidden rounded-[5px] ${
                  restaurant.cover_image_url ? '' : borderNoCover
                }`}
                title={restaurant.display_name}
                aria-label={restaurant.display_name}
              >
                {restaurant.cover_image_url ? (
                  <>
                    <img
                      src={restaurant.cover_image_url}
                      alt=""
                      className="size-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 pt-3 pb-1">
                      <p className="line-clamp-1 text-center text-[10px] font-medium text-white">
                        {restaurant.display_name}
                      </p>
                    </div>
                  </>
                ) : (
                  <div
                    className="flex size-full items-center justify-center px-1.5"
                    style={{ background: TIER_SLOT_VAR[tier] }}
                    aria-hidden="true"
                  >
                    <RestaurantNameGlyphCover name={restaurant.display_name} tier={tier} />
                  </div>
                )}
              </Link>
            )
          }
          if (i === showAddAt) {
            return (
              <Link
                key={i}
                to="/practice/step1"
                className="flex aspect-square basis-1/4 shrink-0 items-center justify-center rounded-none bg-neutral-50 text-neutral-400 active:bg-neutral-100"
                aria-label={`添加${TIER_LABEL[tier]}餐厅`}
              >
                <Plus size={20} strokeWidth={1.6} />
              </Link>
            )
          }
          return (
            <div
              key={i}
              className="aspect-square basis-1/4 shrink-0 bg-neutral-50"
              aria-hidden="true"
            />
          )
        })}
      </div>
    </div>
  )
}
