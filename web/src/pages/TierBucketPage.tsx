import { ChevronRight, MapPin } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useDisplayedTierMap } from '@/features/tier-map/useTierMap'
import { TIER_LABEL, TIER_ORDER, type Tier } from '@/lib/db'

function isTier(k: string | undefined): k is Tier {
  return Boolean(k && (TIER_ORDER as readonly string[]).includes(k))
}

export function TierBucketPage() {
  const raw = useParams<{ tier?: string }>().tier
  const tierParam = typeof raw === 'string' ? raw : undefined

  if (!tierParam || !isTier(tierParam)) {
    return <Navigate to="/tier-map" replace />
  }

  const tier = tierParam
  const { map, showingDemo } = useDisplayedTierMap()

  const bucket = map.buckets.find((b) => b.tier === tier)

  const count = bucket?.count ?? 0
  const rests = bucket?.restaurants ?? []

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-white pb-8">
      <BackHeader title={`${TIER_LABEL[tier]}档位`} backTo="/tier-map" />
      <div className="px-4 pt-4">
        <div className="flex items-end justify-between gap-3 pb-4">
          <div>
            <p className="text-lg font-semibold tracking-tight text-neutral-900">
              共收录 <span className="tabular-nums">{count}</span> 家
            </p>
            {showingDemo ? (
              <p className="mt-1 text-[11px] text-amber-700">
                当前为示例或本地预览视图，与你的真实足迹一致时请关闭示例按钮。
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-500">与同页食鉴图的数据源一致。</p>
            )}
          </div>
          <Link to="/practice/step1" className="shrink-0 text-[13px] font-semibold text-orange-600">
            去录入 <ChevronRight className="-mt-px inline size-[14px]" aria-hidden />
          </Link>
        </div>

        <div className="space-y-3">
          {rests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              这个档位还没有店铺。
            </p>
          ) : (
            rests.map((restaurant) => (
              <Link
                key={restaurant.id}
                to={`/restaurants/${restaurant.id}`}
                className="block rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm shadow-black/[0.04] active:bg-neutral-50"
              >
                <div className="flex gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                    {restaurant.cover_image_url ? (
                      <img src={restaurant.cover_image_url} alt="" className="size-full object-cover" />
                    ) : (
                      <MapPin className="size-6 text-orange-500" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">
                        {restaurant.display_name}
                      </h3>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-300" aria-hidden />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {restaurant.category_name ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          {restaurant.category_name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-neutral-500">
                      {restaurant.city_id || '城市未录入'}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
