import { Link } from 'react-router-dom'
import { RestaurantNameGlyphCover } from '@/features/practice/RestaurantNameGlyphCover'
import { TierLabelBlock } from '@/features/tier-map/TierLabelBlock'
import { TIER_SLOT_VAR, type Tier } from '@/lib/db'
import type { TierMapItem } from '@/features/tier-map/useTierMap'

const MAX_SLOTS = 4

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
  const displayRestaurants = restaurants.slice(0, MAX_SLOTS).reverse()
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => i)

  const borderNoCover = 'box-border border-[0.5px] border-solid border-neutral-400/75'

  return (
    <div className="grid grid-cols-[20%_1fr] items-start gap-0">
      <TierLabelBlock tier={tier} count={count} href={`/tiers/${tier}`} />

      <div className="flex overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slots.map((i) => {
          const restaurant = displayRestaurants[i]
          if (restaurant) {
            return (
              <Link
                key={i}
                to={`/restaurants/${restaurant.id}`}
                className={`group relative flex aspect-square basis-1/4 shrink-0 flex-col overflow-hidden rounded-[5px] ${
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
