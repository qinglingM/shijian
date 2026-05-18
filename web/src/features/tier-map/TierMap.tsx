import { TierRow } from '@/features/tier-map/TierRow'
import type { TierBucket } from '@/features/tier-map/useTierMap'

export function TierMap({
  buckets,
}: {
  buckets: TierBucket[]
}) {
  return (
    <div className="flex flex-col divide-y-[3px] divide-solid divide-neutral-950 overflow-hidden px-0">
      {buckets.map((b) => (
        <TierRow
          key={b.tier}
          tier={b.tier}
          count={b.restaurants.length}
          restaurants={b.restaurants}
        />
      ))}
    </div>
  )
}
