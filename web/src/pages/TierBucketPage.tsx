import { ChevronRight } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { TierRow } from '@/features/tier-map/TierRow'
import { useDisplayedTierMap } from '@/features/tier-map/useTierMap'
import { TIER_LABEL, TIER_ORDER, type Tier } from '@/lib/db'

function isTier(k: string | undefined): k is Tier {
  return Boolean(k && (TIER_ORDER as readonly string[]).includes(k))
}

export function TierBucketPage() {
  const raw = useParams<{ tier?: string }>().tier
  const tierParam = typeof raw === 'string' ? raw : undefined

  if (!tierParam || !isTier(tierParam)) {
    return <Navigate to="/" replace />
  }

  const tier = tierParam
  const { map, showingDemo } = useDisplayedTierMap()

  const bucket = map.buckets.find((b) => b.tier === tier)

  const count = bucket?.count ?? 0
  const rests = bucket?.restaurants ?? []

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-white pb-8">
      <BackHeader title={`${TIER_LABEL[tier]}档位`} />
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
        <TierRow tier={tier} count={count} restaurants={rests} />
      </div>
    </div>
  )
}
