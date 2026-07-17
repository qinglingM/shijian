import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useDishDetail } from '@/features/dishes/useDishDetail'
import { useDishReviewsByDish } from '@/features/dishes/useDishReviewsByDish'
import { isRestaurantUuid, useRestaurant } from '@/features/restaurants/useRestaurant'
import { useDishReviewVoteMutation } from '@/features/restaurants/useDishReviewVoteMutation'
import { intentAfterVoteTap } from '@/features/restaurants/storeReviewVotes'
import { filterVisibleItemsByBlockedUser } from '@/features/blocks/blockedUserSelectors'
import { ContentReportDialog } from '@/features/reports/ContentReportDialog'
import { ContentReportMenuButton, type ContentReportMenuPayload } from '@/features/reports/ContentReportMenuButton'
import { filterVisibleDishReviews, isDishReviewHidden } from '@/features/reports/reportedContentSelectors'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBlockedUsersStore } from '@/stores/blockedUsersStore'
import { useReportedContentStore } from '@/stores/reportedContentStore'
import { useRequireLogin } from '@/features/auth/useRequireLogin'
const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

function isLikelyReviewImage(url: string | null) {
  if (!url) return false
  const u = url.toLowerCase()
  const avatarHints = ['avatar', 'profile', 'user', 'head', 'portrait']
  return !avatarHints.some((k) => u.includes(k))
}

export function DishDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId ?? null

  const isUuid = Boolean(id && isRestaurantUuid(id))
  const dishQ = useDishDetail(isUuid ? id : null)
  const dish = dishQ.data
  const reviewsQ = useDishReviewsByDish(isUuid ? id : null)
  const restaurantQ = useRestaurant(dish?.restaurant_id ?? null)
  const user = useAuthStore((s) => s.user)
  const blockedUserIds = useBlockedUsersStore((s) => s.blockedUserIds)
  const hiddenTargets = useReportedContentStore((s) => s.hiddenTargets)
  const requireLogin = useRequireLogin()
  const voteMut = useDishReviewVoteMutation(dish?.restaurant_id ?? null)

  const [sort, setSort] = useState<'latest' | 'hot' | 'score'>('hot')
  const [reportPayload, setReportPayload] = useState<ContentReportMenuPayload | null>(null)
  const [showReportedToast, setShowReportedToast] = useState(false)

  const visibleReviews = useMemo(
    () => filterVisibleDishReviews(filterVisibleItemsByBlockedUser(reviewsQ.data ?? [], blockedUserIds), hiddenTargets),
    [blockedUserIds, hiddenTargets, reviewsQ.data],
  )

  useEffect(() => {
    if (!showReportedToast) return
    const timer = setTimeout(() => setShowReportedToast(false), 3000)
    return () => clearTimeout(timer)
  }, [showReportedToast])

  const sortedReviews = useMemo(() => {
    const list = visibleReviews
    const copy = [...list]
    if (sort === 'latest') {
      copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else if (sort === 'hot') {
      copy.sort((a, b) => {
        const netA = (b.youpin_count ?? 0) - (b.yebang_count ?? 0)
        const netB = (a.youpin_count ?? 0) - (a.yebang_count ?? 0)
        return netA - netB
      })
    } else if (sort === 'score') {
      copy.sort((a, b) => {
        const sa = a.score ?? -1
        const sb = b.score ?? -1
        return sb - sa
      })
    }
    return copy
  }, [sort, visibleReviews])

  const bestCoverUrl = useMemo(() => {
    const reviews = visibleReviews
    if (!reviews || reviews.length === 0) return dish?.cover_image_url ?? null
    const withImages = reviews
      .filter((r) => r.image_url && isLikelyReviewImage(r.image_url))
      .sort(
        (a, b) =>
          (b.youpin_count - b.yebang_count) -
          (a.youpin_count - a.yebang_count),
      )
    return withImages[0]?.image_url ?? dish?.cover_image_url ?? null
  }, [visibleReviews, dish?.cover_image_url])

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
  const scoredReviews = visibleReviews.filter((review) => review.score !== null)
  const avgText =
    scoredReviews.length > 0
      ? Number(
          scoredReviews.reduce((sum, review) => sum + (review.score ?? 0), 0)
          / scoredReviews.length,
        ).toFixed(1)
      : dish.avg_score !== null && dish.avg_score !== undefined
        ? Number(dish.avg_score).toFixed(1)
        : null
  const topComment = visibleReviews.find((review) => review.comment?.trim())?.comment?.trim() ?? dish.top_comment
  const reviewCount = visibleReviews.length

  return (
    <>
      <BackHeader
        title="菜品详情"
        centerTitle
        backTo={dish.restaurant_id ? `/restaurants/${dish.restaurant_id}` : undefined}
      />
      <div className="min-h-[calc(100vh-3rem)] bg-white pb-10">
        <div className="relative h-[12rem] w-full bg-neutral-100">
          {bestCoverUrl ? (
            <img src={bestCoverUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm font-semibold tracking-widest text-neutral-400">
              {(dish.name.slice(0, 4).replace(/\s/g, '') || '菜').slice(0, 4)}
            </div>
          )}
        </div>

        <div className="mx-4 -mt-6 relative z-[1]">
          <section className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-md shadow-orange-500/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-black leading-snug tracking-tight text-neutral-950">
                  {dish.name}
                </h1>
                {topComment ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-600 line-clamp-2">
                    {topComment}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-neutral-500">
                  {rr ? (
                    <Link
                      to={`/restaurants/${rr.id}`}
                      className="text-orange-600 underline-offset-2 hover:underline"
                    >
                      {rr.display_name}
                    </Link>
                  ) : restaurantQ.isPending ? (
                    <span className="text-neutral-400">载入餐厅链…</span>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {avgText ? (
                  <div>
                    <span className="text-[34px] font-black tabular-nums leading-none text-orange-600">
                      {avgText}
                    </span>
                    <span className="ml-0.5 text-base font-bold text-neutral-500">分</span>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-neutral-400">暂无均分</span>
                )}
                <p className="mt-1 text-[11px] text-neutral-400">
                  {reviewCount} 条收录
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 px-4">
          {reviewsQ.isPending ? (
            <p className="py-10 text-center text-sm text-neutral-400">载入评价列表…</p>
          ) : visibleReviews.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-[0.2em] text-neutral-400 uppercase">
                  用户评价
                </h2>
                <ReviewSortBar value={sort} onChange={setSort} />
              </div>
              <ul className="space-y-3">
                {sortedReviews.map((rv) => {
                const votingThis =
                  voteMut.isPending && voteMut.variables?.dishReviewId === rv.id
                const reviewHidden = isDishReviewHidden(hiddenTargets, rv.id)
                function onTap(which: 'youpin' | 'yebang') {
                  if (!requireLogin()) return
                  const next = intentAfterVoteTap(rv.my_vote, which)
                  voteMut.mutate({ dishReviewId: rv.id, dishId: id!, next })
                }

                const reviewImageUrl = isLikelyReviewImage(rv.image_url)
                  ? rv.image_url
                  : null

                if (reviewHidden) return null

                return (
                  <li
                    key={rv.id}
                    className="rounded-2xl border border-orange-100 bg-white px-3 py-3 shadow-sm shadow-orange-500/6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-sky-700">
                        {rv.reviewer_nickname}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[10px] text-neutral-400">
                          {dateFmt.format(new Date(rv.created_at))}
                        </span>
                        <ContentReportMenuButton
                          iconSize={14}
                          buttonClassName="flex size-6 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-100"
                          payload={{
                            title: '菜品评价',
                            targets: [
                              {
                                label: '评价内容',
                                targetType: 'dish_review',
                                targetId: rv.id,
                                snapshot: {
                                  dish_id: id,
                                  user_id: rv.reviewer_user_id,
                                  reviewer_nickname: rv.reviewer_nickname,
                                  created_at: rv.created_at,
                                  score: rv.score,
                                  comment: rv.comment,
                                  image_url: rv.image_url,
                                },
                              },
                              ...(reviewImageUrl
                                ? [{
                                     label: '图片',
                                     targetType: 'dish_review_image' as const,
                                     targetId: rv.id,
                                     snapshot: {
                                       dish_id: id,
                                       user_id: rv.reviewer_user_id,
                                       reviewer_nickname: rv.reviewer_nickname,
                                       created_at: rv.created_at,
                                       image_url: rv.image_url,
                                      comment: rv.comment,
                                    },
                                  }]
                                : []),
                            ],
                          }}
                          onOpenReport={setReportPayload}
                        />
                      </div>
                    </div>
                    <div className="mt-[9px] flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[14px] leading-6 font-bold text-neutral-800 [&::before]:content-['“'] [&::after]:content-['”']">
                        {rv.comment?.trim() || '（未填写菜品锐评）'}
                      </p>
                      {reviewImageUrl ? (
                        <img
                          src={reviewImageUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-neutral-200/80"
                        />
                      ) : null}
                      <span className="shrink-0 pt-0.5">
                        <span className="text-[28px] font-black italic leading-none text-sky-600">
                          {rv.score !== null ? rv.score : '—'}
                        </span>
                        <span className="ml-0.5 text-[11px] font-semibold text-sky-600">分</span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={votingThis}
                        title={!user ? '登录后参与有品投票' : '觉得这条菜评中肯、有参考价值'}
                        aria-pressed={rv.my_vote === 'youpin'}
                        onClick={() => onTap('youpin')}
                        className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
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
                        disabled={votingThis}
                        title={!user ? '登录后参与野榜投票' : '觉得这条菜评离谱、参考价值低'}
                        aria-pressed={rv.my_vote === 'yebang'}
                        onClick={() => onTap('yebang')}
                        className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
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
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              暂无匿名用户评价。
            </p>
          )}
        </section>
      </div>
      {showReportedToast ? (
        <div className="fixed left-1/2 top-0 z-[100] -translate-x-1/2 pt-[calc(var(--safe-top)+0.5rem)] px-5 pb-3 text-sm font-medium text-green-800">
          <div className="rounded-2xl bg-green-50 px-5 py-3 shadow-lg ring-1 ring-green-200/60">
            已收到举报并隐藏该内容
          </div>
        </div>
      ) : null}
      <ContentReportDialog
        open={!!reportPayload}
        title={reportPayload?.title ?? '内容'}
        onClose={() => setReportPayload(null)}
        targets={reportPayload?.targets ?? []}
        onReported={() => setShowReportedToast(true)}
      />
    </>
  )
}

const SORT_OPTIONS = [
  { value: 'latest' as const, label: '最新' },
  { value: 'hot' as const, label: '最热' },
  { value: 'score' as const, label: '高分' },
]

function ReviewSortBar({
  value,
  onChange,
}: {
  value: 'latest' | 'hot' | 'score'
  onChange: (v: 'latest' | 'hot' | 'score') => void
}) {
  return (
    <div className="flex items-center gap-1">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
            value === opt.value
              ? 'bg-orange-100 text-orange-900'
              : 'text-neutral-400 active:bg-neutral-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
