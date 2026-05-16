import { Link, Navigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Bookmark, ChevronDown, MapPin, UserRound } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import {
  getDemoStoreReviews,
  lookupDemoRestaurant,
} from '@/features/restaurants/demoRestaurantMeta'
import { useDishesByRestaurant } from '@/features/dishes/useDishesByRestaurant'
import {
  useRestaurant,
  isRestaurantUuid,
  type RestaurantDetail,
} from '@/features/restaurants/useRestaurant'
import {
  applyStoreReviewVoteClick,
  intentAfterVoteTap,
} from '@/features/restaurants/storeReviewVotes'
import {
  useRestaurantDishReviews,
  type RestaurantDishReviewItem,
} from '@/features/restaurants/useRestaurantDishReviews'
import {
  useStoreReviewsByRestaurant,
  type StoreReviewItem,
} from '@/features/restaurants/useStoreReviewsByRestaurant'
import { useStoreReviewVoteMutation } from '@/features/restaurants/useStoreReviewVoteMutation'
import { useRestaurantBole } from '@/features/restaurants/useRestaurantBole'
import { useRestaurantGuidanceSummary } from '@/features/restaurants/useRestaurantGuidanceSummary'
import { useInsertMarkMutation, useDeleteMarkMutation } from '@/features/marks/useRestaurantMarkMutations'
import { useRestaurantMarkStatus } from '@/features/marks/useRestaurantMarkStatus'
import { TIER_COLOR_VAR, TIER_LABEL, TIER_ORDER, type PoiSource, type Tier } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type TabKey = 'store' | 'dish'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

function tierInk(tier: Tier) {
  return tier === 'bad' ? '#171717' : TIER_COLOR_VAR[tier]
}

export function RestaurantDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId ?? null
  const [tab, setTab] = useState<TabKey>('store')

  const demoMeta = id ? lookupDemoRestaurant(id) : null
  const isDemo = !!demoMeta
  const isUuid = id ? isRestaurantUuid(id) : false

  const governanceRid =
    id && isUuid && !isDemo && isSupabaseConfigured ? id : null
  const boleQ = useRestaurantBole(governanceRid)
  const guidanceQ = useRestaurantGuidanceSummary(governanceRid)
  const viewerId = useAuthStore((s) => s.user?.id ?? null)

  const restaurantQ = useRestaurant(isUuid ? id : null)
  const storeRQ = useStoreReviewsByRestaurant(isUuid ? id : null)
  const dishRQ = useRestaurantDishReviews(isUuid ? id : null)
  const dishesQ = useDishesByRestaurant(isUuid ? id : null)

  const storeReviewsDemo = useMemo(
    () => (isDemo && id && demoMeta ? getDemoStoreReviews(id, demoMeta.tier) : []),
    [isDemo, id, demoMeta],
  )

  if (!id) return <Navigate to="/" replace />

  if (!isDemo && !isUuid) {
    return (
      <>
        <BackHeader title="餐厅详情" />
        <div className="px-5 py-16 text-center text-sm text-neutral-500">
          无法识别门店链接，返回食鉴首页再进入。
          <Link to="/" className="mt-4 inline-block font-medium text-orange-600">
            回首页
          </Link>
        </div>
      </>
    )
  }

  const awaitingBackend =
    isUuid &&
    !isDemo &&
    isSupabaseConfigured &&
    restaurantQ.isPending &&
    !restaurantQ.data

  if (awaitingBackend) {
    return (
      <>
        <BackHeader title="餐厅详情" />
        <div className="px-5 py-10 text-center text-sm text-neutral-400">载入门店信息…</div>
      </>
    )
  }

  const notConfigured = isUuid && !isDemo && !isSupabaseConfigured
  if (notConfigured) {
    return (
      <>
        <BackHeader title="餐厅详情" />
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          查看真实门店需要先配置 Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）。
        </div>
      </>
    )
  }

  let title = '餐厅详情'
  let coverUrl: string | null = null

  if (isDemo && demoMeta) {
    title = demoMeta.display_name
    coverUrl = demoMeta.cover_image_url
  } else if (isUuid && restaurantQ.data) {
    title = restaurantQ.data.display_name
    coverUrl = restaurantQ.data.cover_image_url
  }

  const storeList = isDemo
    ? storeReviewsDemo
    : (storeRQ.data ?? []).filter(Boolean)
  const dishFeed: RestaurantDishReviewItem[] = isDemo ? [] : (dishRQ.data ?? [])
  const dishes = isDemo ? [] : (dishesQ.data ?? [])

  const dominantPublicTier = dominantTierFromReviewList(storeList)
  const headerTierShown =
    dominantPublicTier ?? (isDemo && demoMeta ? demoMeta.tier : null)
  const storeTierLoading = Boolean(isUuid && !isDemo && storeRQ.isPending)

  const uuidNotFound =
    isUuid && !isDemo && restaurantQ.isFetched && restaurantQ.data === null && !restaurantQ.isPending

  if (!isDemo && isUuid && restaurantQ.isError) {
    return (
      <>
        <BackHeader title="餐厅详情" />
        <p className="px-5 py-10 text-center text-sm text-rose-500">
          读取失败：
          {(restaurantQ.error as Error)?.message ?? '未知错误'}
        </p>
      </>
    )
  }

  if (uuidNotFound) {
    return (
      <>
        <BackHeader title="门店未找到" />
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          该门店不存在或你已无权查看。
          <Link to="/" className="mt-4 inline-block font-medium text-orange-600">
            回首页
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <BackHeader title={title} />
      <div className="min-h-[calc(100vh-3rem)] bg-white pb-8">
        {(isDemo && demoMeta) || (isUuid && restaurantQ.data) ? (
          <section className="border-b border-neutral-100 px-4 pt-4 pb-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm shadow-black/[0.04]">
              <div className="flex gap-4">
              <div className="relative h-[6.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-neutral-100 text-center text-xs font-semibold tracking-widest text-neutral-500">
                    {(title.slice(0, 4).replace(/\s/g, '') || '门店').slice(0, 4)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h1 className="text-[18px] font-black leading-snug tracking-tight text-neutral-950">
                        {title}
                      </h1>
                      {isDemo && demoMeta ? (
                        <>
                          <span className="text-neutral-300" aria-hidden>
                            ·
                          </span>
                          <span className="text-[13px] font-semibold text-neutral-700">
                            {[demoMeta.city_name, demoMeta.district_name]
                              .filter(Boolean)
                              .join(' ') || '—'}
                          </span>
                          <span className="text-neutral-300" aria-hidden>
                            ·
                          </span>
                          <span className="text-[13px] text-neutral-600">
                            {demoMeta.category_name}
                          </span>
                        </>
                      ) : null}
                      {!isDemo && isUuid && restaurantQ.data ? (
                        <>
                          <span className="text-neutral-300" aria-hidden>
                            ·
                          </span>
                          {restaurantCityDistrictLine(restaurantQ.data) ? (
                            <span className="text-[13px] font-semibold text-neutral-700">
                              {restaurantCityDistrictLine(restaurantQ.data)}
                            </span>
                          ) : (
                            <span className="text-[13px] text-neutral-400">城市未录入</span>
                          )}
                          <span className="text-neutral-300" aria-hidden>
                            ·
                          </span>
                          <span className="text-[13px] text-neutral-600">
                            {restaurantQ.data.category_name?.trim() || '未录入分类'}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {isDemo && demoMeta && demoMeta.address_detail ? (
                      <p className="flex items-start gap-1.5 pt-0.5 text-[13px] leading-snug text-neutral-700">
                        <MapPin
                          className="mt-0.5 size-3.5 shrink-0 text-neutral-400"
                          aria-hidden
                        />
                        <span>{demoMeta.address_detail}</span>
                      </p>
                    ) : null}

                    {!isDemo && isUuid && restaurantQ.data ? (
                      restaurantStreetLine(restaurantQ.data) ? (
                        <p className="flex items-start gap-1.5 pt-0.5 text-[13px] leading-snug text-neutral-700">
                          <MapPin
                            className="mt-0.5 size-3.5 shrink-0 text-neutral-400"
                            aria-hidden
                          />
                          <span>{restaurantStreetLine(restaurantQ.data)}</span>
                        </p>
                      ) : !restaurantCityDistrictLine(restaurantQ.data) ? (
                        <p className="pt-0.5 text-[12px] text-neutral-400">暂未录入城市与地址</p>
                      ) : (
                        <p className="pt-0.5 text-[12px] text-neutral-400">
                          暂无门牌或补充位置信息
                        </p>
                      )
                    ) : null}

                    {!isDemo && isUuid && restaurantQ.data
                      ? (() => {
                          const subline = [
                            poiSourceLabel(restaurantQ.data.poi_source),
                            restaurantQ.data.branch_name
                              ? `${restaurantQ.data.brand_name} · ${restaurantQ.data.branch_name}`
                              : restaurantQ.data.brand_name,
                          ]
                            .filter((x): x is string => Boolean(x?.trim()))
                            .join(' · ')
                          return subline ? (
                            <p className="text-[11px] leading-snug text-neutral-400">{subline}</p>
                          ) : null
                        })()
                      : isDemo ? (
                          <p className="text-[11px] text-neutral-400">示例数据 · 仅供界面预览</p>
                        ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!isDemo && isUuid && isSupabaseConfigured && id ? (
                      <RestaurantMarkActions restaurantId={id} viewerId={viewerId ?? null} />
                    ) : null}
                    <HeaderTierPanel
                      tier={headerTierShown}
                      loading={storeTierLoading}
                      isDemo={Boolean(isDemo)}
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </section>
        ) : null}

        {governanceRid && restaurantQ.data ? (
          (() => {
            const g = guidanceQ.data
            const guidanceLine =
              !guidanceQ.isPending &&
              !guidanceQ.isError &&
              g &&
              g.feedback_count > 0 &&
              g.guidance_rate_pct !== null

            if (!boleQ.isPending && !boleQ.data && !guidanceLine) return null

            return (
              <section className="border-b border-neutral-100 px-4 pb-3 pt-0.5">
                {boleQ.isPending ? (
                  <p className="text-[11px] text-neutral-400">载入伯乐信息…</p>
                ) : boleQ.data ? (
                  <p className="text-[11px] leading-relaxed text-neutral-600">
                    <span className="font-semibold text-neutral-800">食鉴伯乐</span>
                    ：{boleQ.data.nickname ?? '食鉴用户'}
                    <span className="text-neutral-400">
                      {' '}
                      · {dateFmt.format(new Date(boleQ.data.awarded_at))}
                    </span>
                  </p>
                ) : null}
                {guidanceLine && g ? (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-relaxed text-neutral-600">
                    <span>
                      <span className="font-semibold text-neutral-800">好评诱导反馈</span>
                      ：约{' '}
                      <span className="tabular-nums font-semibold text-neutral-900">
                        {g.guidance_rate_pct}%
                      </span>{' '}
                      的实践用户反馈该店存在诱导写好评。
                    </span>
                    <details className="inline text-neutral-400">
                      <summary className="-ml-0.5 cursor-pointer select-none tabular-nums">
                        ⓘ
                      </summary>
                      <span className="mt-1 block text-[10px] leading-relaxed text-neutral-500">
                        {g.guidance_rate_pct}% 的实践用户反馈：该店存在好评诱导。包括写好评送东西、返现、打折、送菜、送饮料、小物品等情况。不显示具体是谁勾选。
                      </span>
                    </details>
                  </p>
                ) : null}
              </section>
            )
          })()
        ) : null}

        <div className="mt-4 px-4">
          <div className="flex rounded-full bg-neutral-100 p-1">
            {(
              [
                ['store', '店铺评价', storeList.length] as const,
                ['dish', '菜品评价', dishFeed.length || dishes.length] as const,
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                  tab === key
                    ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-orange-100'
                    : 'text-neutral-500'
                }`}
              >
                {label}
                <span className="ml-1 text-[11px] font-bold text-orange-600">{count}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 px-2 text-[11px] leading-relaxed text-neutral-500">
            {tab === 'store'
              ? '每条店评底部固定两颗表态键「有品 / 野榜」。登录后与数据库投票表同步；再点已选一侧为撤回，点另一侧为改投（同一账号对同一条店评仅保留一种立场）。'
              : '展示这家店已入库菜品的公开菜评流，并可进入上架菜品条目查看详情（含用户对菜品的分项评价）。'}
          </p>
        </div>

        <div className="mt-4 px-4">
          {tab === 'store' ? (
            <StoreTab
              demo={isDemo}
              restaurantId={isUuid ? id ?? null : null}
              loading={Boolean(isUuid && !isDemo && storeRQ.isPending)}
              reviews={storeList}
            />
          ) : (
            <DishTabFeed
              isDemo={isDemo}
              dishFeedPending={Boolean(isUuid && !isDemo && dishRQ.isPending)}
              dishesPending={Boolean(isUuid && !isDemo && dishesQ.isPending)}
              dishReviews={dishFeed}
              dishes={dishes}
            />
          )}
        </div>
      </div>
    </>
  )
}

function restaurantCityDistrictLine(r: RestaurantDetail) {
  const s = [r.city_name, r.district_name].filter(Boolean).join(' ')
  return s || null
}

function restaurantStreetLine(r: RestaurantDetail) {
  const s = [r.address_text, r.location_hint].filter(Boolean).join(' · ')
  return s || null
}

function HeaderTierPanel({
  tier,
  loading,
  isDemo,
}: {
  tier: Tier | null
  loading: boolean
  isDemo: boolean
}) {
  return (
    <div className="shrink-0 text-right leading-none">
      {loading ? (
        <p className="text-[15px] font-semibold text-neutral-400">…</p>
      ) : tier ? (
        <p
          className="text-[17px] font-black tracking-tight"
          style={{ color: tierInk(tier) }}
        >
          {TIER_LABEL[tier]}
        </p>
      ) : (
        <p className="text-[12px] font-medium text-neutral-400">
          {isDemo ? '示例' : '暂无店评'}
        </p>
      )}
    </div>
  )
}

function storeReviewNet(r: StoreReviewItem) {
  return r.youpin_count - r.yebang_count
}

/** database-spec 14.4 · product-spec 12.2 综合排序（仅「最热」模式使用） */
function compareStoreReviewsCompound(
  a: StoreReviewItem,
  b: StoreReviewItem,
  slice: StoreReviewItem[],
  highNetFirst: boolean,
): number {
  const allStrictlyNeg = slice.every((r) => r.youpin_count < r.yebang_count)
  const cmpBase = !allStrictlyNeg
    ? storeReviewNet(b) - storeReviewNet(a)
    : Math.abs(storeReviewNet(b)) - Math.abs(storeReviewNet(a))
  const cmp = highNetFirst ? cmpBase : -cmpBase
  if (cmp !== 0) return cmp
  const timeCmp = b.created_at.localeCompare(a.created_at)
  return highNetFirst ? timeCmp : -timeCmp
}

function filterAndSortStoreReviews(
  list: StoreReviewItem[],
  tierFilter: Tier | 'all',
  sortMode: 'latest' | 'compound',
  newestFirst: boolean,
  compoundHighNetFirst: boolean,
) {
  const filtered =
    tierFilter === 'all' ? list : list.filter((r) => r.tier === tierFilter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'latest') {
      const t = newestFirst
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
      if (t !== 0) return t
      return storeReviewNet(b) - storeReviewNet(a)
    }
    return compareStoreReviewsCompound(a, b, filtered, compoundHighNetFirst)
  })
  return sorted
}

function poiSourceLabel(poi: PoiSource | null | undefined) {
  if (!poi) return null
  const map = {
    amap: '高德地图',
    manual: '手动补充',
    tencent: '腾讯地图',
    baidu: '百度地图',
    apple: 'Apple 地图',
  } as Record<string, string>
  return map[poi] ?? String(poi)
}

function StoreTab({
  reviews,
  loading,
  demo,
  restaurantId,
}: {
  reviews: StoreReviewItem[]
  loading: boolean
  demo?: boolean
  restaurantId: string | null
}) {
  const user = useAuthStore((s) => s.user)
  const voteMut = useStoreReviewVoteMutation(!demo ? restaurantId : null)
  const [demoVotes, setDemoVotes] = useState<
    Record<string, { y: number; b: number; m: 'youpin' | 'yebang' | null }>
  >({})

  const displayReviews = useMemo(() => {
    return reviews.map((r) => {
      const o = demoVotes[r.id]
      if (!o) return r
      return { ...r, youpin_count: o.y, yebang_count: o.b, my_vote: o.m }
    })
  }, [reviews, demoVotes])

  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all')
  const [sortMode, setSortMode] = useState<'latest' | 'compound'>('latest')
  const [newestFirst, setNewestFirst] = useState(true)
  const [compoundHighNetFirst, setCompoundHighNetFirst] = useState(true)

  const filteredSorted = useMemo(
    () =>
      filterAndSortStoreReviews(
        displayReviews,
        tierFilter,
        sortMode,
        newestFirst,
        compoundHighNetFirst,
      ),
    [displayReviews, tierFilter, sortMode, newestFirst, compoundHighNetFirst],
  )

  if (loading) {
    return <p className="py-14 text-center text-sm text-neutral-400">载入店铺公开评价…</p>
  }
  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
        {demo ? '本条示例暂只挂载少量店评。' : '还没有用户公开这间店的食鉴档位或店铺锐评。'}
      </p>
    )
  }

  const sortQuiet =
    '-m-0.5 border-0 bg-transparent px-1.5 py-0.5 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-neutral-800 focus:outline-none'
  const sortOnTime =
    '-m-0.5 border-0 bg-transparent px-1.5 py-0.5 text-[13px] font-bold text-orange-700 transition-colors hover:text-orange-800 focus:outline-none'
  const sortOnHeat =
    '-m-0.5 border-0 bg-transparent px-1.5 py-0.5 text-[13px] font-bold text-violet-700 transition-colors hover:text-violet-800 focus:outline-none'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={
              newestFirst
                ? '按发布时间从新到旧（再点从旧到新）。'
                : '按发布时间从旧到新（再点从新到旧）。'
            }
            aria-pressed={sortMode === 'latest'}
            onClick={() => {
              if (sortMode === 'latest') setNewestFirst((v) => !v)
              else setSortMode('latest')
            }}
            className={sortMode === 'latest' ? sortOnTime : sortQuiet}
          >
            <span className="inline-flex items-center gap-0.5">
              最新
              <span
                className={`text-[11px] tabular-nums ${
                  sortMode === 'latest'
                    ? 'font-bold text-orange-800/90'
                    : 'font-semibold text-neutral-400'
                }`}
                aria-hidden
              >
                {newestFirst ? '↓' : '↑'}
              </span>
            </span>
          </button>
          <button
            type="button"
            title={
              compoundHighNetFirst
                ? '综合：有品−野榜净值高优先；净值相同较新优先；若全部为负则按|净值|大优先。再点反转。'
                : '综合排序已反转优先方向。'
            }
            aria-pressed={sortMode === 'compound'}
            onClick={() => {
              if (sortMode === 'compound') setCompoundHighNetFirst((v) => !v)
              else setSortMode('compound')
            }}
            className={sortMode === 'compound' ? sortOnHeat : sortQuiet}
          >
            <span className="inline-flex items-center gap-0.5">
              最热
              <span
                className={`text-[11px] tabular-nums ${
                  sortMode === 'compound'
                    ? 'font-bold text-violet-800/90'
                    : 'font-semibold text-neutral-400'
                }`}
                aria-hidden
              >
                {compoundHighNetFirst ? '↓' : '↑'}
              </span>
            </span>
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[13px] font-medium text-neutral-600">筛选</span>
          <div className="relative min-w-0 max-w-[12rem] flex-1">
            <select
              aria-label="按段位筛选店铺评价"
              className="w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent py-0.5 pl-0.5 pr-5 text-[13px] font-medium text-neutral-900 outline-none ring-0 focus:border-0 focus:ring-0 focus:outline-none"
              value={tierFilter === 'all' ? '' : tierFilter}
              onChange={(e) => {
                const v = e.target.value
                setTierFilter(v === '' ? 'all' : (v as Tier))
              }}
            >
              <option value="">默认</option>
              {TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
              strokeWidth={2}
              aria-hidden
            />
          </div>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          当前档位下没有符合条件的店评，试试「默认」或其它档位。
        </p>
      ) : null}

      <ul className="space-y-3">
      {filteredSorted.map((r) => {
        const votingThis =
          voteMut.isPending && voteMut.variables?.practiceRecordId === r.id

        function onTap(which: 'youpin' | 'yebang') {
          if (demo) {
            setDemoVotes((prev) => {
              const o = prev[r.id]
              const baseY = o?.y ?? r.youpin_count
              const baseB = o?.b ?? r.yebang_count
              const mine =
                o?.m ?? r.my_vote ?? null
              const n = applyStoreReviewVoteClick(baseY, baseB, mine, which)
              return { ...prev, [r.id]: { y: n.youpin, b: n.yebang, m: n.mine } }
            })
            return
          }
          if (!user) {
            window.alert('请先登录后再参与有品 / 野榜投票')
            return
          }
          const base = reviews.find((x) => x.id === r.id)
          if (!base) return
          const next = intentAfterVoteTap(base.my_vote, which)
          voteMut.mutate({ practiceRecordId: r.id, next })
        }

        const guestBlocked = !demo && !user
        const busy = votingThis

        return (
          <li
            key={r.id}
            className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm shadow-black/[0.04]"
          >
            <div className="px-3 pb-2 pt-3">
              <div className="flex items-start gap-2">
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt=""
                    className="size-9 shrink-0 rounded-full object-cover ring-2 ring-neutral-100"
                  />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 ring-2 ring-neutral-100">
                    <UserRound className="size-[1.125rem] text-neutral-400" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-neutral-950">
                      {r.nickname}
                    </span>
                    <span
                      className="shrink-0 text-[13px] font-black tracking-tight"
                      style={{ color: tierInk(r.tier) }}
                    >
                      {TIER_LABEL[r.tier]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-800">
                    {r.store_comment?.trim() || '（未填写店铺锐评）'}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="relative z-[1] flex min-h-[2.875rem] items-center justify-between gap-2 px-3 pb-2.5 pt-0"
              role="group"
              aria-label="有品野榜表态"
            >
              <hr className="absolute left-3 right-3 top-0 border-neutral-100" />

              <span className="relative shrink-0 whitespace-nowrap text-[10px] tabular-nums text-neutral-400">
                {dateFmt.format(new Date(r.created_at))}
              </span>
              <div className="relative flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy || guestBlocked}
                title={guestBlocked ? '请先登录' : '觉得这条店评中肯、有参考价值'}
                aria-pressed={r.my_vote === 'youpin'}
                onClick={() => onTap('youpin')}
                className={`inline-flex min-w-[5.875rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  r.my_vote === 'youpin'
                    ? 'bg-orange-50 text-orange-950 shadow-[inset_0_0_0_2px_rgb(251_146_60)]'
                    : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-orange-50/60'
                }`}
              >
                有品
                <span className="tabular-nums opacity-85">{r.youpin_count}</span>
              </button>
              <button
                type="button"
                disabled={busy || guestBlocked}
                title={guestBlocked ? '请先登录' : '觉得这条店评离谱、参考价值低'}
                aria-pressed={r.my_vote === 'yebang'}
                onClick={() => onTap('yebang')}
                className={`inline-flex min-w-[5.875rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  r.my_vote === 'yebang'
                    ? 'bg-violet-50 text-violet-950 shadow-[inset_0_0_0_2px_rgb(167_139_250)]'
                    : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-violet-50/55'
                }`}
              >
                野榜
                <span className="tabular-nums opacity-85">{r.yebang_count}</span>
              </button>
              </div>
            </div>
            {voteMut.isError &&
            voteMut.variables?.practiceRecordId === r.id &&
            !demo ? (
              <p className="relative z-[1] px-3 pb-2 text-[10px] text-rose-600">
                {(voteMut.error as Error)?.message ?? '投票失败'}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
    </div>
  )
}

function RestaurantMarkActions({
  restaurantId,
  viewerId,
}: {
  restaurantId: string
  viewerId: string | null
}) {
  const statusQ = useRestaurantMarkStatus(viewerId, restaurantId)
  const insertM = useInsertMarkMutation(restaurantId)
  const deleteM = useDeleteMarkMutation(restaurantId)

  if (!viewerId) {
    return (
      <Link
        to={`/auth?redirect=/restaurants/${restaurantId}`}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 text-[11px] font-semibold text-neutral-600 ring-1 ring-neutral-200 active:bg-neutral-200"
        title="登录后可标记想去"
      >
        <Bookmark className="size-3.5" aria-hidden />
        标记
      </Link>
    )
  }

  if (statusQ.isPending) {
    return (
      <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-neutral-100 px-2.5 text-[11px] font-semibold text-neutral-400">
        载入…
      </span>
    )
  }

  if (statusQ.isError) {
    return (
      <span
        className="inline-flex h-8 shrink-0 items-center rounded-full bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100"
        title={(statusQ.error as Error)?.message ?? '无法读取标记状态'}
      >
        标记失败
      </span>
    )
  }

  const st = statusQ.data

  if (st === 'reviewed') {
    return (
      <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
        已食鉴
      </span>
    )
  }

  const marked = st === 'marked'
  const busy = insertM.isPending || deleteM.isPending

  if (st === 'marked') {
    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={marked}
        title="再次点击取消标记"
        onClick={() => deleteM.mutate()}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-orange-600 px-2.5 text-[11px] font-semibold text-white shadow-sm shadow-orange-900/20 active:bg-orange-700 disabled:opacity-50"
      >
        <Bookmark className="size-3.5 fill-current" aria-hidden />
        {busy ? '处理中…' : '已标记'}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={marked}
      title="标记到想去"
      onClick={() => insertM.mutate()}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 text-[11px] font-semibold text-orange-800 ring-1 ring-orange-200/80 active:bg-orange-100 disabled:opacity-50"
    >
      <Bookmark className="size-3.5" aria-hidden />
      {busy ? '处理中…' : '标记'}
    </button>
  )
}

function dominantTierFromReviewList(
  rows: Array<{ tier: Tier }>,
): Tier | null {
  if (!rows.length) return null
  const m = new Map<Tier, number>()
  for (const row of rows) m.set(row.tier, (m.get(row.tier) ?? 0) + 1)
  let best: Tier | null = null
  let bestCount = 0
  for (const [t, n] of m) {
    if (n > bestCount) {
      best = t
      bestCount = n
    }
  }
  return best
}

function DishTabFeed({
  dishReviews,
  dishes,
  isDemo,
  dishFeedPending,
  dishesPending,
}: {
  dishReviews: RestaurantDishReviewItem[]
  dishes: import('@/features/dishes/useDishesByRestaurant').DishLite[]
  isDemo: boolean
  dishFeedPending: boolean
  dishesPending: boolean
}) {
  if (isDemo) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm leading-6 text-neutral-500">
        示例模式下没有后端菜品实体。
        <br />
        完成提交食鉴或使用真实 UUID 后即可查看收录菜品与公开菜评。
      </p>
    )
  }

  const busy = dishFeedPending || dishesPending
  if (busy) {
    return <p className="py-14 text-center text-sm text-neutral-400">载入菜评与菜品列表…</p>
  }

  return (
    <div className="space-y-6">
      {dishReviews.length > 0 ? (
        <div>
          <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-neutral-600">
            公开菜品评价（按时间倒序）
          </h2>
          <ul className="space-y-3">
            {dishReviews.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm shadow-orange-500/6"
              >
                <Link
                  to={`/dishes/${r.dish_id}`}
                  className="text-[15px] font-bold text-orange-700 underline-offset-4 hover:underline"
                >
                  {r.dish_name}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-neutral-500">
                    {r.reviewer_nickname}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    · {dateFmt.format(new Date(r.created_at))}
                  </span>
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: tierInk(r.store_tier) }}
                  >
                    · {TIER_LABEL[r.store_tier]}档
                  </span>
                  <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-[12px] font-black text-orange-800">
                    {r.score !== null ? `${r.score}` : '—'} 分
                  </span>
                </div>
                {r.comment ? (
                  <p className="mt-2 text-[14px] leading-6 text-neutral-800">{r.comment}</p>
                ) : null}
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt=""
                    className="mt-2 max-h-48 w-full rounded-xl object-cover"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-neutral-600">
          这家店已入库的菜品
        </h2>
        {dishes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
            这家店还没有入库菜品。
          </p>
        ) : (
          <ul className="space-y-2">
            {dishes.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/dishes/${d.id}`}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-2.5 active:bg-neutral-50"
                >
                  {d.cover_image_url ? (
                    <img src={d.cover_image_url} alt="" className="size-11 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-500">
                      {d.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-neutral-900">{d.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {d.avg_score !== null ? `均分 ${Number(d.avg_score).toFixed(1)}` : '暂无均分'}{' '}
                      · {d.review_count} 条评价
                      {(d.youpin_count ?? 0) > 0 || (d.yebang_count ?? 0) > 0 ? (
                        <>
                          {' '}
                          ·{' '}
                          <span className="text-violet-700">有品 {d.youpin_count ?? 0}</span>
                          {' · '}
                          <span className="text-neutral-600">野榜 {d.yebang_count ?? 0}</span>
                        </>
                      ) : null}
                    </p>
                    {d.top_comment?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-600">
                        <span className="font-semibold text-neutral-500">代表锐评</span> ·{' '}
                        {d.top_comment.trim()}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-orange-600">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
