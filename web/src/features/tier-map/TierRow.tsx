import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { RestaurantNameGlyphCover } from '@/features/practice/RestaurantNameGlyphCover'
import { TierLabelBlock } from '@/features/tier-map/TierLabelBlock'
import { TIER_SLOT_VAR, type Tier } from '@/lib/db'
import type { TierMapItem } from '@/features/tier-map/useTierMap'

const CARD_SIZE_CLASS = 'w-[5.25rem]'

interface TierRowProps {
  tier: Tier
  count: number
  restaurants: TierMapItem[]
}

export function TierRow({
  tier,
  count,
  restaurants,
}: TierRowProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const displayRestaurants = [...restaurants].reverse()

  const borderNoCover = 'box-border border-[0.5px] border-solid border-neutral-400/75'

  useLayoutEffect(() => {
    const node = trackRef.current
    if (!node) return
    node.scrollLeft = node.scrollWidth
  }, [displayRestaurants.length])

  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-stretch gap-x-0">
      <TierLabelBlock tier={tier} count={count} href={`/tiers/${tier}`} />

      <div
        ref={trackRef}
        className="min-w-0 overflow-x-auto overscroll-x-contain py-[3px] pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-[3px]">
          {displayRestaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              to={`/restaurants/${restaurant.id}`}
              className={`group relative flex aspect-square shrink-0 flex-col overflow-hidden rounded-[5px] ${CARD_SIZE_CLASS} ${
                restaurant.cover_image_url ? '' : borderNoCover
              }`}
              title={restaurant.display_name}
              aria-label={restaurant.display_name}
            >
              {restaurant.cover_image_url ? (
                <>
                  <div className="min-h-0 flex-[3] overflow-hidden">
                    <img
                      src={restaurant.cover_image_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex flex-[1] items-center justify-center bg-white px-1">
                    <p className="line-clamp-1 text-center text-[9px] font-medium text-neutral-800">
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
          ))}
        </div>
      </div>
    </div>
  )
}
