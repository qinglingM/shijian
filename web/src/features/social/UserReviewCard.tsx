import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'

export interface UserReviewCardProps {
  restaurantId: string
  restaurantName: string
  coverUrl: string | null
  comment: string | null
  tierLabel: string
  cityName: string | null
  districtName: string | null
  addressText: string | null
}

export function UserReviewCard({
  restaurantId,
  restaurantName,
  coverUrl,
  comment,
  tierLabel,
  cityName,
  districtName,
  addressText,
}: UserReviewCardProps) {
  return (
    <Link
      to={`/restaurants/${restaurantId}`}
      className="block rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm shadow-black/[0.04] active:bg-neutral-50"
    >
      <div className="flex gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <MapPin className="size-6 text-orange-500" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">
              {restaurantName}
            </h3>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-300" aria-hidden />
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-600">
            {comment || '这个评价还没有锐评。'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-700 ring-1 ring-orange-100">
              {tierLabel}
            </span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
              {[cityName, districtName].filter(Boolean).join(' ') || '城市未知'}
            </span>
          </div>
          {addressText ? (
            <p className="mt-1 line-clamp-1 text-[11px] text-neutral-400">{addressText}</p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
