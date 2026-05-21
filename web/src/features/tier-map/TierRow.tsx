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
    <div className="grid grid-cols-[90px_1fr] items-center gap-0">
      <TierLabelBlock tier={tier} count={count} href={`/tiers/${tier}`} />

      <div className="flex gap-x-[2.5px] overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slots.map((i) => {
          const restaurant = displayRestaurants[i]
          if (restaurant) {
            return (
              <Link
                key={i}
                to={`/restaurants/${restaurant.id}`}
                className={`group relative flex aspect-square w-[85px] shrink-0 flex-col overflow-hidden rounded-[5px] ${
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-black/65 to-transparent" />
                    <p className="absolute inset-x-0 bottom-0 truncate text-center text-[9px] font-medium text-white px-1">
                      {restaurant.display_name}
                    </p>
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
              className="aspect-square w-[85px] shrink-0 bg-neutral-50"
              aria-hidden="true"
            />
          )
        })}
      </div>
    </div>
  )
}
