import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Home, Store } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'

export type PracticeDoneLocationState = {
  restaurantId: string
  brandName?: string
  /** 本次为更新既有食鉴（同店同用户仅一条有效记录） */
  wasUpdate?: boolean
}

export function PracticeDonePage() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: PracticeDoneLocationState | null }

  const restaurantId = state?.restaurantId
  const brandName = state?.brandName?.trim()
  const wasUpdate = !!state?.wasUpdate

  useEffect(() => {
    if (!restaurantId) {
      navigate('/map', { replace: true })
    }
  }, [restaurantId, navigate])

  if (!restaurantId) return null

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col px-4 pb-8 pt-2">
      <BackHeader title="完成" backTo="/" />

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-rose-100 text-orange-600 shadow-inner ring-1 ring-orange-200/80">
          <CheckCircle2 size={40} strokeWidth={2} aria-hidden />
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
          恭喜，这次食鉴已提交成功
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          {wasUpdate
            ? '你已在这家店有过食鉴记录，本次内容已更新为最新版本（每位用户每家店仅保留一条有效食鉴）。'
            : '你的餐厅档位与评价内容已记入食鉴库；若填写了菜品，评分也会一并保存。感谢分享真实体验。'}
        </p>
        {brandName && (
          <p className="mt-4 line-clamp-2 text-sm font-medium text-neutral-800">{brandName}</p>
        )}

        <div className="mt-10 w-full space-y-3">
          <Link
            to={`/restaurants/${restaurantId}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-700/25"
          >
            <Store size={18} strokeWidth={2.2} aria-hidden />
            查看这家店
          </Link>
          <Link
            to="/map"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white py-3.5 text-sm font-medium text-neutral-800 active:bg-neutral-50"
          >
            <Home size={18} strokeWidth={2.2} aria-hidden />
            回到美食地图
          </Link>
        </div>
      </div>
    </div>
  )
}
