import { Link, Navigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useDishDetail } from '@/features/dishes/useDishDetail'
import { useDishReviewsByDish } from '@/features/dishes/useDishReviewsByDish'
import { isRestaurantUuid, useRestaurant } from '@/features/restaurants/useRestaurant'
import { TIER_COLOR_VAR, TIER_LABEL, type Tier } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

function tierInk(tier: Tier) {
  return tier === 'bad' ? '#171717' : TIER_COLOR_VAR[tier]
}

export function DishDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId ?? null

  const isUuid = Boolean(id && isRestaurantUuid(id))
  const dishQ = useDishDetail(isUuid ? id : null)
  const dish = dishQ.data
  const reviewsQ = useDishReviewsByDish(isUuid ? id : null)
  const restaurantQ = useRestaurant(dish?.restaurant_id ?? null)

  if (!id) return <Navigate to="/" replace />

  if (!isUuid) {
    return (
      <>
        <BackHeader title="菜品详情" />
        <div className="px-5 py-16 text-center text-sm text-neutral-500">
          无效的菜品链接。
          <Link to="/" className="mt-4 inline-block font-medium text-orange-600">
            回首页
          </Link>
        </div>
      </>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <BackHeader title="菜品详情" />
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          查看菜品需配置 Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）。
        </div>
      </>
    )
  }

  if (dishQ.isPending && !dish) {
    return (
      <>
        <BackHeader title="菜品详情" />
        <p className="px-5 py-10 text-center text-sm text-neutral-400">载入菜品…</p>
      </>
    )
  }

  if (dishQ.isError) {
    return (
      <>
        <BackHeader title="菜品详情" />
        <p className="px-5 py-10 text-center text-sm text-rose-500">
          读取失败：{(dishQ.error as Error)?.message ?? '未知错误'}
        </p>
      </>
    )
  }

  if (dishQ.isFetched && !dish) {
    return (
      <>
        <BackHeader title="未找到菜品" />
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          该菜品不存在或已下架。
          <Link to="/" className="mt-4 inline-block font-medium text-orange-600">
            回首页
          </Link>
        </div>
      </>
    )
  }

  if (!dish) return null

  const rr = restaurantQ.data
  const avgText =
    dish.avg_score !== null && dish.avg_score !== undefined
      ? Number(dish.avg_score).toFixed(1)
      : null

  return (
    <>
      <BackHeader title={dish.name} />
      <div className="min-h-[calc(100vh-3rem)] bg-white pb-10">
        <div className="relative h-[12rem] w-full bg-neutral-100">
          {dish.cover_image_url ? (
            <img src={dish.cover_image_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm font-semibold tracking-widest text-neutral-400">
              {(dish.name.slice(0, 4).replace(/\s/g, '') || '菜').slice(0, 4)}
            </div>
          )}
        </div>

        <div className="mx-4 -mt-6 relative z-[1] space-y-3">
          <section className="rounded-2xl border border-orange-100 bg-white px-4 py-3.5 shadow-md shadow-orange-500/10">
            <h1 className="text-lg font-black leading-snug tracking-tight text-neutral-950">
              {dish.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {avgText ? (
                <>
                  <span className="text-2xl font-black tabular-nums text-orange-600">
                    {avgText}
                  </span>
                  <span className="text-sm font-bold text-neutral-700">分</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-neutral-400">暂无均分</span>
              )}
              <span className="text-xs text-neutral-500">· {dish.review_count} 条收录</span>
            </div>
            {dish.top_comment ? (
              <p className="mt-3 rounded-xl bg-orange-50/80 px-3 py-2 text-[13px] leading-relaxed text-neutral-800 ring-1 ring-orange-100/80">
                <span className="font-bold text-orange-800">热评摘录 · </span>
                {dish.top_comment}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold text-neutral-500">
              <span>有品赞同 {dish.youpin_count}</span>
              <span>野榜 {dish.yebang_count}</span>
              {rr ? (
                <Link
                  to={`/restaurants/${rr.id}`}
                  className="ml-auto text-orange-600 underline-offset-2 hover:underline"
                >
                  所属餐厅 · {rr.display_name}
                </Link>
              ) : restaurantQ.isPending ? (
                <span className="ml-auto text-neutral-400">载入餐厅链…</span>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-8 px-4">
          <h2 className="mb-3 text-xs font-bold tracking-[0.2em] text-neutral-400 uppercase">
            用户评价
          </h2>
          {reviewsQ.isPending ? (
            <p className="py-10 text-center text-sm text-neutral-400">载入评价列表…</p>
          ) : reviewsQ.data && reviewsQ.data.length > 0 ? (
            <ul className="space-y-3">
              {reviewsQ.data.map((rv) => (
                <li
                  key={rv.id}
                  className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm shadow-orange-500/6"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-neutral-900">
                      {rv.reviewer_nickname}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {dateFmt.format(new Date(rv.created_at))}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: tierInk(rv.store_tier) }}
                    >
                      {TIER_LABEL[rv.store_tier]}档
                    </span>
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[12px] font-black text-orange-800">
                      {rv.score !== null ? `${rv.score}` : '—'} 分
                    </span>
                  </div>
                  {rv.comment ? (
                    <p className="mt-2 text-[14px] leading-6 text-neutral-800">{rv.comment}</p>
                  ) : null}
                  {rv.image_url ? (
                    <img
                      src={rv.image_url}
                      alt=""
                      className="mt-2 max-h-48 w-full rounded-xl object-cover"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              暂无公开用户评价。
            </p>
          )}
        </section>
      </div>
    </>
  )
}
