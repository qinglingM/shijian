import { Link, Navigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useDishDetail } from '@/features/dishes/useDishDetail'
import { useDishReviewsByDish } from '@/features/dishes/useDishReviewsByDish'
import { isRestaurantUuid, useRestaurant } from '@/features/restaurants/useRestaurant'
import { useDishReviewVoteMutation } from '@/features/restaurants/useDishReviewVoteMutation'
import { intentAfterVoteTap } from '@/features/restaurants/storeReviewVotes'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

export function DishDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId ?? null

  const isUuid = Boolean(id && isRestaurantUuid(id))
  const dishQ = useDishDetail(isUuid ? id : null)
  const dish = dishQ.data
  const reviewsQ = useDishReviewsByDish(isUuid ? id : null)
  const restaurantQ = useRestaurant(dish?.restaurant_id ?? null)
  const user = useAuthStore((s) => s.user)
  const voteMut = useDishReviewVoteMutation(dish?.restaurant_id ?? null)

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
              {reviewsQ.data.map((rv) => {
                const votingThis =
                  voteMut.isPending && voteMut.variables?.dishReviewId === rv.id
                const guestBlocked = !user

                function onTap(which: 'youpin' | 'yebang') {
                  if (!user) {
                    window.alert('请先登录后再参与有品 / 野榜投票')
                    return
                  }
                  const next = intentAfterVoteTap(rv.my_vote, which)
                  voteMut.mutate({ dishReviewId: rv.id, dishId: id!, next })
                }

                return (
                  <li
                    key={rv.id}
                    className="rounded-2xl border border-orange-100 bg-white px-3 py-3 shadow-sm shadow-orange-500/6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-neutral-900">
                          {rv.reviewer_nickname}
                        </span>
                        <span className="ml-2 text-[11px] text-neutral-400">
                          {dateFmt.format(new Date(rv.created_at))}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[12px] font-black text-orange-800">
                        {rv.score !== null ? `${rv.score}` : '—'} 分
                      </span>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[14px] leading-6 text-neutral-800">
                        {rv.comment?.trim() || '（未填写菜品锐评）'}
                      </p>
                      {rv.image_url ? (
                        <img
                          src={rv.image_url}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-neutral-200/80"
                        />
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={votingThis || guestBlocked}
                        title={guestBlocked ? '请先登录' : '觉得这条菜评中肯、有参考价值'}
                        aria-pressed={rv.my_vote === 'youpin'}
                        onClick={() => onTap('youpin')}
                        className={`inline-flex min-w-[4.75rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                          rv.my_vote === 'youpin'
                            ? 'bg-orange-50 text-orange-950 shadow-[inset_0_0_0_2px_rgb(251_146_60)]'
                            : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-orange-50/60'
                        }`}
                      >
                        有品
                        <span className="tabular-nums opacity-85">{rv.youpin_count}</span>
                      </button>
                      <button
                        type="button"
                        disabled={votingThis || guestBlocked}
                        title={guestBlocked ? '请先登录' : '觉得这条菜评离谱、参考价值低'}
                        aria-pressed={rv.my_vote === 'yebang'}
                        onClick={() => onTap('yebang')}
                        className={`inline-flex min-w-[4.75rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                          rv.my_vote === 'yebang'
                            ? 'bg-violet-50 text-violet-950 shadow-[inset_0_0_0_2px_rgb(167_139_250)]'
                            : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-violet-50/55'
                        }`}
                      >
                        野榜
                        <span className="tabular-nums opacity-85">{rv.yebang_count}</span>
                      </button>
                    </div>
                    {voteMut.isError && voteMut.variables?.dishReviewId === rv.id ? (
                      <p className="mt-2 px-1 text-[10px] text-rose-600">
                        {(voteMut.error as Error)?.message ?? '投票失败'}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              暂无匿名用户评价。
            </p>
          )}
        </section>
      </div>
    </>
  )
}
