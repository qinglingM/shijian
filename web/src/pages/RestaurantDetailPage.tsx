import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Flag, MapPin, Share2, Utensils, UserRound, X } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { lookupExistingRestaurantByPoi } from '@/features/poi-search/usePoiSearch'
import { fetchExistingPracticeHydration } from '@/features/practice/hydratePracticeDraftFromServer'
import {
  getDemoStoreReviews,
  lookupDemoRestaurant,
} from '@/features/restaurants/demoRestaurantMeta'

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
import { useDishReviewVoteMutation } from '@/features/restaurants/useDishReviewVoteMutation'
import { useRestaurantBole, type RestaurantBoleView } from '@/features/restaurants/useRestaurantBole'
import { useRestaurantGuidanceSummary } from '@/features/restaurants/useRestaurantGuidanceSummary'
import { TIER_COLOR_VAR, TIER_LABEL, TIER_ORDER, type Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeDraft } from '@/stores/practiceDraft'
import type { PoiCandidate, PoiSource } from '@/lib/poi/types'
import { getCategoryLabel } from '@/lib/poi/amap-category-rules'

type TabKey = 'store' | 'dish'

const POI_SOURCES = new Set<PoiSource>(['amap', 'manual', 'tencent', 'baidu', 'apple'])

function isPoiSource(value: string | undefined): value is PoiSource {
  return !!value && POI_SOURCES.has(value as PoiSource)
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

const compactDateFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function tierInk(tier: Tier) {
  return tier === 'bad' ? '#171717' : TIER_COLOR_VAR[tier]
}

function compactDate(dateLike: string, digits: 'yyyyMMdd' | 'yyMMdd') {
  const full = compactDateFmt.format(new Date(dateLike)).replace(/\D/g, '')
  return digits === 'yyMMdd' ? full.slice(2) : full
}

export function RestaurantDetailPage() {
  const location = useLocation()
  const { id: rawId, source: poiSource, poiId } = useParams()
  const poiState = location.state as { poi?: PoiCandidate } | null
  const poi = poiState?.poi ?? null
  const routePoiSource = isPoiSource(poiSource) ? poiSource : null
  const isPoiRoute = Boolean(routePoiSource && poiId)
  const id = rawId ?? (isPoiRoute ? `poi:${routePoiSource}:${poiId}` : null)
  const [tab, setTab] = useState<TabKey>('store')

  const demoMeta = id ? lookupDemoRestaurant(id) : null
  const isDemo = !!demoMeta
  const isUuid = id ? isRestaurantUuid(id) : false

  const governanceRid =
    id && isUuid && !isDemo && isSupabaseConfigured ? id : null
  const boleQ = useRestaurantBole(governanceRid)
  const guidanceQ = useRestaurantGuidanceSummary(governanceRid)
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  const navigate = useNavigate()
  const setPoiDraft = usePracticeDraft((s) => s.setPoi)
  const setExistingRestaurantDraft = usePracticeDraft((s) => s.setExistingRestaurant)
  const setReturnTo = usePracticeDraft((s) => s.setReturnTo)
  const applyHydratedDraft = usePracticeDraft((s) => s.applyHydratedPracticeFromServer)

  const myPracticeQ = useQuery({
    queryKey: ['my-practice-check', isUuid ? id : null, viewerId],
    enabled: isSupabaseConfigured && !!viewerId && isUuid && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await getSupabase()
        .from('practice_records')
        .select('id, tier')
        .eq('user_id', viewerId!)
        .eq('restaurant_id', id!)
        .eq('is_active', true)
        .maybeSingle()
      return data ?? null
    },
  })
  const myTier = myPracticeQ.data?.tier ?? null
  const hasExistingReview = !!myPracticeQ.data

  const restaurantQ = useRestaurant(isUuid ? id : null)
  const storeRQ = useStoreReviewsByRestaurant(isUuid ? id : null)
  const dishRQ = useRestaurantDishReviews(isUuid ? id : null)


  const storeReviewsDemo = useMemo(
    () => (isDemo && id && demoMeta ? getDemoStoreReviews(id, demoMeta.tier) : []),
    [isDemo, id, demoMeta],
  )
  const detailKnown = Boolean(isDemo || (isUuid && restaurantQ.data))
  const emptyReviews = !isDemo && isPoiRoute

  if (!id) return <Navigate to="/" replace />

  if (!isDemo && !isUuid && !isPoiRoute) {
    return (
      <>
        <BackHeader title="店铺详情" />
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

  const notConfigured = isUuid && !isDemo && !isPoiRoute && !isSupabaseConfigured
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

  let title = '店铺详情'
  let coverUrl: string | null = null
  let cityDistrictText: string | null = null
  let addressText: string | null = null
  let categoryText: string | null = null
  if (isDemo && demoMeta) {
    title = demoMeta.display_name
    coverUrl = demoMeta.cover_image_url
    cityDistrictText = [demoMeta.city_name, demoMeta.district_name].filter(Boolean).join(' ') || null
    addressText = demoMeta.address_detail || null
    categoryText = demoMeta.category_name
  } else if (isUuid && restaurantQ.data) {
    title = restaurantQ.data.display_name
    coverUrl = restaurantQ.data.cover_image_url
    cityDistrictText = restaurantCityDistrictLine(restaurantQ.data)
    addressText = restaurantStreetLine(restaurantQ.data)
    categoryText = restaurantQ.data.category_name?.trim()
      || restaurantQ.data.display_category_label?.trim()
      || null
    // 优先展示 中类·小类（如 "中餐厅·火锅店"）
    const mid = restaurantQ.data.amap_mid_category?.trim()
    const sub = restaurantQ.data.amap_small_category?.trim()
    if (mid && sub) {
      categoryText = `${mid}·${sub}`
    } else if (mid || sub) {
      categoryText = mid || sub
    }
  } else if (poi) {
    title = poi.poi_name
    coverUrl = poi.cover_image_url ?? null
    cityDistrictText = [poi.city_name, poi.district_name].filter(Boolean).join(' ') || null
    addressText = poi.address_text?.trim() || null
    categoryText = poi.category?.trim() ? getCategoryLabel(poi.category.trim()) : null
  }

  const storeList = isDemo
    ? storeReviewsDemo
    : (storeRQ.data ?? []).filter(Boolean)
  const dishFeed: RestaurantDishReviewItem[] = isDemo ? [] : (dishRQ.data ?? [])

  const fallbackPoi =
    !poi && isPoiRoute && routePoiSource && poiId
      ? ({
          poi_source: routePoiSource,
          poi_id: poiId,
          poi_name: title,
          address_text: addressText ?? '',
          latitude: null,
          longitude: null,
          province_name: null,
          city_name: cityDistrictText?.split(' ')[0] ?? null,
          district_name: cityDistrictText?.split(' ').slice(1).join(' ') || null,
          category: categoryText,
          cover_image_url: coverUrl,
        } satisfies PoiCandidate)
      : null

  const dominantPublicTier = dominantTierFromReviewList(storeList)
  const headerTierShown =
    dominantPublicTier ?? (isDemo && demoMeta ? demoMeta.tier : null)
  const headerTierFallback = emptyReviews ? null : headerTierShown
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
        <BackHeader title="店铺详情" />
        <div className="px-5 py-10 text-center text-sm text-neutral-500">
          该门店不存在或你已无权查看。
          <Link to="/" className="mt-4 inline-block font-medium text-orange-600">
            回首页
          </Link>
        </div>
      </>
    )
  }

  async function beginPracticeFromDetail() {
    if (isDemo) {
      navigate('/practice/step1')
      return
    }

    const practicePoi = poi ?? fallbackPoi
    const targetRestaurantId =
      isUuid && id
        ? id
        : practicePoi
          ? await lookupExistingRestaurantByPoi(practicePoi.poi_source, practicePoi.poi_id)
          : null

    let willReplace = false
    if (viewerId && targetRestaurantId) {
      const { data, error } = await getSupabase()
        .from('practice_records')
        .select('id')
        .eq('user_id', viewerId)
        .eq('restaurant_id', targetRestaurantId)
        .eq('is_active', true)
        .maybeSingle()
      if (!error) willReplace = !!data
    }

    if (practicePoi) {
      setPoiDraft(practicePoi, targetRestaurantId, willReplace)
    } else if (isUuid && restaurantQ.data && id) {
      setExistingRestaurantDraft(
        {
          id,
          display_name: restaurantQ.data.display_name,
          address_text: restaurantQ.data.address_text,
          location_hint: restaurantQ.data.location_hint,
          latitude: restaurantQ.data.latitude,
          longitude: restaurantQ.data.longitude,
          city_id: restaurantQ.data.city_id,
          city_name: restaurantQ.data.city_name,
          district_id: restaurantQ.data.district_id,
          district_name: restaurantQ.data.district_name,
          cover_image_url: restaurantQ.data.cover_image_url,
          category_id: restaurantQ.data.category_id,
          category_name: restaurantQ.data.category_name,
        },
        willReplace,
      )
    } else {
      navigate('/practice/step1')
      return
    }

    if (willReplace && viewerId && targetRestaurantId) {
      try {
        const payload = await fetchExistingPracticeHydration(viewerId, targetRestaurantId)
        if (payload) applyHydratedDraft(payload)
      } catch (e) {
        console.warn('[shijian] hydrate practice draft failed:', e)
      }
    }

    setReturnTo(location.pathname)

    navigate('/practice/step2', {
      state: { poi: practicePoi, from: location.pathname },
    })
  }

  return (
    <>
      <RestaurantDetailHeader
        title={title}
        shareData={{
          url: window.location.href,
          title,
        }}
      />
      <div className="min-h-[calc(100vh-3rem)] bg-white pb-8">
        {detailKnown ? (
          <section className="border-b border-neutral-100 px-4 pt-4 pb-4">
            <div className="relative flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm shadow-black/[0.04]">
              <div className="flex gap-4">
                <div className="relative mt-1 h-[6.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
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
                    <div className="min-w-0 flex-1">
                      <h1 className="text-[16px] font-black leading-snug tracking-tight text-neutral-950">
                        {title}
                      </h1>
                      {categoryText ? (
                        <p className="mt-0.5 text-[12px] font-semibold text-neutral-700">{categoryText}</p>
                      ) : null}
                      {isDemo && demoMeta && demoMeta.address_detail ? (
                        <p className="pt-0.5 text-[12px] leading-snug text-neutral-500">{demoMeta.address_detail}</p>
                      ) : null}
                      {addressText || cityDistrictText ? (
                        <p className="pt-0.5 text-[12px] leading-snug text-neutral-500">{[cityDistrictText, addressText].filter(Boolean).join(' · ')}</p>
                      ) : isUuid && !isDemo ? (
                        <p className="pt-0.5 text-[12px] text-neutral-400">暂未录入城市与地址</p>
                      ) : null}
                    </div>

                    <HeaderTierCard
                      storeTier={headerTierFallback}
                      myTier={myTier}
                      hasExistingReview={hasExistingReview}
                      loading={storeTierLoading}
                      storeEmptyLabel="暂无店评"
                    />
                  </div>
                </div>
              </div>

              {isDemo ? (
                <p className="text-[11px] text-neutral-400">示例数据 · 仅供界面预览</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {emptyReviews ? (
          <section className="border-b border-neutral-100 px-4 pt-4 pb-4">
            <div className="relative flex flex-col gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm shadow-black/[0.04]">
              <div className="flex gap-4">
                <div className="relative mt-1 h-[6.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-center text-xs font-semibold tracking-widest text-orange-700">
                    待评价
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h1 className="text-[16px] font-black leading-snug tracking-tight text-neutral-950">
                          {title}
                        </h1>
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100">
                          待首评
                        </span>
                      </div>
                      {categoryText ? (
                        <p className="text-[12px] font-semibold text-neutral-700">{categoryText}</p>
                      ) : null}
                      <p className="flex items-start gap-1.5 pt-0.5 text-[13px] leading-snug text-neutral-700">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span>{[cityDistrictText, addressText].filter(Boolean).join(' · ') || '地址暂未录入'}</span>
                      </p>
                      <p className="text-[11px] text-neutral-400">快来成为第一个伯乐吧</p>
                    </div>
                    <HeaderTierCard
                      storeTier={null}
                      myTier={null}
                      hasExistingReview={false}
                      loading={false}
                      storeEmptyLabel="暂无店评"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {(() => {
          const g = guidanceQ.data
          const guidanceLine =
            !guidanceQ.isPending &&
            !guidanceQ.isError &&
            g &&
            g.feedback_count > 0 &&
            g.guidance_rate_pct !== null

          if (!emptyReviews && !governanceRid && !boleQ.data && !guidanceLine) return null
          if (!emptyReviews && !governanceRid) return null

          return (
            <section className="border-b border-neutral-100 px-4 pb-3 pt-0.5">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-neutral-600">
                <span className="mt-0.5 shrink-0 rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-700 ring-1 ring-orange-100">
                  食鉴伯乐
                </span>
                <span className="min-w-0 flex-1 pt-0.5 leading-5">
                  {emptyReviews
                    ? '暂未被任何伯乐发现'
                    : boleQ.isPending
                      ? '载入伯乐信息…'
                      : boleQ.data
                        ? formatBoleText(boleQ.data)
                        : null}
                </span>
              </p>
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
        })()}

        <div className="mt-4 px-4">
          <div className="flex rounded-full bg-neutral-100 p-1">
            {(
              [
                ['store', '店铺评价', storeList.length] as const,
                ['dish', '菜品评价', dishFeed.length] as const,
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
        </div>

        <div className="mt-4 px-4">
          {tab === 'store' ? (
            <StoreTab
              demo={isDemo}
              restaurantId={isUuid ? id ?? null : null}
              loading={Boolean(isUuid && !isDemo && storeRQ.isPending)}
              reviews={storeList}
              emptyReviews={emptyReviews}
            />
          ) : (
            <DishTabFeed
              restaurantId={isUuid ? id ?? null : null}
              isDemo={isDemo}
              dishFeedPending={Boolean(isUuid && !isDemo && dishRQ.isPending)}
              dishReviews={dishFeed}
            />
          )}
        </div>

        <div className="mt-auto border-t border-neutral-100 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => void beginPracticeFromDetail()}
            className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-orange-700/20 active:from-orange-700 active:to-rose-700"
          >
            {hasExistingReview ? '更新评价' : '写评价'}
          </button>
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

function TierCapsule({
  label,
  value,
  tier,
  empty,
}: {
  label: string
  value: string
  tier: Tier | null
  empty?: boolean
}) {
  const isBad = tier === 'bad'
  const hasTier = tier !== null && !empty

  let outerCls = 'flex flex-col items-center rounded-md px-1 py-1.5 ml-4 min-w-[4rem]'
  let outerStyle: React.CSSProperties = {}

  if (!hasTier) {
    outerCls += ' bg-neutral-200'
  } else if (isBad) {
    outerCls += ' border-2 border-neutral-950'
  } else {
    outerStyle.backgroundColor = TIER_COLOR_VAR[tier]
  }

  return (
    <div className={outerCls} style={outerStyle}>
      <p className="text-[9px] font-semibold tracking-wider text-neutral-950">{label}</p>
      <div className="mt-0.5 w-full rounded bg-white px-1 py-0.5 text-center">
        <p className="text-[11px] font-black text-neutral-950">{value}</p>
      </div>
    </div>
  )
}

function HeaderTierCard({
  storeTier,
  myTier,
  hasExistingReview,
  loading,
  storeEmptyLabel,
}: {
  storeTier: Tier | null
  myTier: Tier | null
  hasExistingReview: boolean
  loading: boolean
  storeEmptyLabel?: string
}) {
  if (loading) {
    return <p className="text-[15px] font-semibold text-neutral-400">…</p>
  }

  const storeLabel = storeTier ? TIER_LABEL[storeTier] : (storeEmptyLabel || '暂无店评')
  const myValue = hasExistingReview && myTier ? TIER_LABEL[myTier] : '待评价'

  return (
    <div className="flex h-[6.5rem] flex-col justify-between">
      <TierCapsule label="店铺等级" value={storeLabel} tier={storeTier} />
      <TierCapsule label="我的评级" value={myValue} tier={hasExistingReview && myTier ? myTier : null} empty={!hasExistingReview || !myTier} />
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

function formatBoleText(bole: RestaurantBoleView) {
  const nickname = bole.nickname?.trim() || '食鉴用户'
  if (bole.created_from === 'manual') {
    return (
      <>
        被 <span className="font-semibold text-sky-600">@{nickname}</span> 于
        {compactDate(bole.awarded_at, 'yyMMdd')} 发现并收录在册
      </>
    )
  }
  return (
    <>
      由 <span className="font-semibold text-sky-600">@{nickname}</span> 于
      {compactDate(bole.awarded_at, 'yyyyMMdd')} 首次完成鉴定
    </>
  )
}

function StoreTab({
  reviews,
  loading,
  demo,
  restaurantId,
  emptyReviews,
}: {
  reviews: StoreReviewItem[]
  loading: boolean
  demo?: boolean
  restaurantId: string | null
  emptyReviews?: boolean
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
    return <p className="py-14 text-center text-sm text-neutral-400">载入店铺匿名评价…</p>
  }
  if (reviews.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
          {demo
            ? '本条示例暂只挂载少量店评。'
            : emptyReviews
              ? '这里还没有人完成首评。'
              : '还没有用户匿名发布这间店的食鉴档位或店铺锐评。'}
        </p>
        {emptyReviews ? (
          <p className="text-center text-[12px] leading-6 text-neutral-500">
            无人评价，快来成为第一个伯乐吧。
          </p>
        ) : null}
      </div>
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
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-sky-700">
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
              className="relative z-[1] flex min-h-[3.5rem] items-end justify-between gap-2 px-3 pb-2.5 pt-2"
              role="group"
              aria-label="有品野榜表态"
            >
              <hr className="absolute left-3 right-3 top-1.5 border-neutral-100" />

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
                className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
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
                className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
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

function RestaurantDetailHeader({
  title,
  shareData,
}: {
  title: string
  shareData: { url: string; title: string }
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareData.title, url: shareData.url })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('链接已复制到剪贴板')
    }
  }

  return (
    <BackHeader title={title} backTo="/tier-map" rightSlot={
      <>
        <button
          type="button"
          onClick={handleShare}
          className="flex size-9 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100"
          aria-label="分享"
        >
          <Share2 size={16} strokeWidth={1.6} />
        </button>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100"
            aria-label="更多"
          >
            {moreOpen ? <X size={16} strokeWidth={1.6} /> : <ChevronDown size={16} strokeWidth={1.6} />}
          </button>

          {moreOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); alert('反馈错误信息功能开发中') }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-neutral-700 active:bg-neutral-50"
                >
                  <Flag size={14} strokeWidth={1.6} className="text-neutral-400" />
                  反馈错误信息
                </button>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); alert('反馈重复店铺功能开发中') }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-neutral-700 active:bg-neutral-50"
                >
                  <Flag size={14} strokeWidth={1.6} className="text-neutral-400" />
                  反馈重复店铺
                </button>
              </div>
            </>
          )}
        </div>
      </>
    } />
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

const SORT_OPTIONS = [
  { value: 'latest' as const, label: '最新' },
  { value: 'hot' as const, label: '最热' },
  { value: 'score' as const, label: '高分' },
]

function DishTabFeed({
  restaurantId,
  dishReviews,
  isDemo,
  dishFeedPending,
}: {
  restaurantId: string | null
  dishReviews: RestaurantDishReviewItem[]
  isDemo: boolean
  dishFeedPending: boolean
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const voteMut = useDishReviewVoteMutation(!isDemo ? restaurantId : null)
  const [sort, setSort] = useState<'latest' | 'hot' | 'score'>('hot')

  if (isDemo) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm leading-6 text-neutral-500">
        示例模式下没有后端菜品实体。
        <br />
        完成提交食鉴或使用真实 UUID 后即可查看收录菜品与匿名菜评。
      </p>
    )
  }

  const busy = dishFeedPending
  if (busy) {
    return <p className="py-14 text-center text-sm text-neutral-400">载入菜评与菜品列表…</p>
  }

  const groupedDisplays = useMemo(() => {
    const groups = new Map<string, RestaurantDishReviewItem[]>()
    for (const r of dishReviews) {
      const arr = groups.get(r.dish_id) ?? []
      arr.push(r)
      groups.set(r.dish_id, arr)
    }

    const entries: {
      dishName: string
      dishId: string
      topReview: RestaurantDishReviewItem
      coverUrl: string | null
    }[] = []

    for (const [dishId, reviews] of groups) {
      const dishName = reviews[0].dish_name

      const sortedForCover = [...reviews].sort(
        (a, b) => (b.youpin_count - b.yebang_count) - (a.youpin_count - a.yebang_count),
      )
      const coverUrl = sortedForCover.find((r) => r.image_url)?.image_url ?? null

      let sortedReviews: RestaurantDishReviewItem[]
      if (sort === 'latest') {
        sortedReviews = [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))
      } else if (sort === 'score') {
        sortedReviews = [...reviews].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      } else {
        sortedReviews = [...reviews].sort(
          (a, b) => (b.youpin_count - b.yebang_count) - (a.youpin_count - a.yebang_count),
        )
      }

      entries.push({ dishName, dishId, topReview: sortedReviews[0], coverUrl })
    }

    if (sort === 'latest') {
      entries.sort((a, b) => b.topReview.created_at.localeCompare(a.topReview.created_at))
    } else if (sort === 'score') {
      entries.sort((a, b) => (b.topReview.score ?? -1) - (a.topReview.score ?? -1))
    } else {
      entries.sort(
        (a, b) =>
          (b.topReview.youpin_count - b.topReview.yebang_count) -
          (a.topReview.youpin_count - a.topReview.yebang_count),
      )
    }

    return entries
  }, [dishReviews, sort])

  return (
    <div className="space-y-6">
      {groupedDisplays.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold tracking-tight text-neutral-600">
              所有菜品评价
            </h2>
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSort(opt.value)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    sort === opt.value
                      ? 'bg-orange-100 text-orange-900'
                      : 'text-neutral-400 active:bg-neutral-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-3">
            {groupedDisplays.map((entry) => {
              const r = entry.topReview
              const votingThis =
                voteMut.isPending && voteMut.variables?.dishReviewId === r.id
              const guestBlocked = !user

              function onTap(which: 'youpin' | 'yebang') {
                if (!user) {
                  window.alert('请先登录后再参与有品 / 野榜投票')
                  return
                }
                const next = intentAfterVoteTap(r.my_vote, which)
                voteMut.mutate({ dishReviewId: r.id, dishId: r.dish_id, next })
              }

              const dishImg = entry.coverUrl ? (
                <img src={entry.coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-orange-50 text-orange-600">
                  <Utensils className="size-4" aria-hidden />
                </div>
              )

              return (
                <li
                  key={entry.dishId}
                  onClick={() => navigate(`/dishes/${entry.dishId}`)}
                  className="cursor-pointer rounded-2xl border border-orange-100 bg-white px-3 py-3 shadow-sm shadow-orange-500/6 active:bg-orange-50/50"
                >
                  <span className="mb-[10px] block truncate text-[12px] font-bold leading-tight text-orange-700">
                    {entry.dishName}
                  </span>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <Link
                        to={`/dishes/${entry.dishId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"
                        aria-label={`查看菜品 ${entry.dishName}`}
                      >
                        {dishImg}
                      </Link>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold text-sky-700">
                          {r.reviewer_nickname}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400">
                          {dateFmt.format(new Date(r.created_at))}
                        </span>
                      </div>
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[14px] leading-6 font-bold text-neutral-800 [&::before]:content-['“'] [&::after]:content-['”']">
                          {r.comment?.trim() || '（未填写菜品锐评）'}
                        </p>
                        <span className="shrink-0 pt-0.5">
                          <span className="text-[28px] font-black italic leading-none text-sky-600">
                            {r.score !== null ? r.score : '—'}
                          </span>
                          <span className="ml-0.5 text-[11px] font-semibold text-sky-600">分</span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={votingThis || guestBlocked}
                          title={guestBlocked ? '请先登录' : '觉得这条菜评中肯、有参考价值'}
                          aria-pressed={r.my_vote === 'youpin'}
                          onClick={(e) => { e.stopPropagation(); onTap('youpin') }}
                          className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
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
                          disabled={votingThis || guestBlocked}
                          title={guestBlocked ? '请先登录' : '觉得这条菜评离谱、参考价值低'}
                          aria-pressed={r.my_vote === 'yebang'}
                          onClick={(e) => { e.stopPropagation(); onTap('yebang') }}
                          className={`inline-flex min-w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
                            r.my_vote === 'yebang'
                              ? 'bg-violet-50 text-violet-950 shadow-[inset_0_0_0_2px_rgb(167_139_250)]'
                              : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-violet-50/55'
                          }`}
                        >
                          野榜
                          <span className="tabular-nums opacity-85">{r.yebang_count}</span>
                        </button>
                      </div>
                      {voteMut.isError && voteMut.variables?.dishReviewId === r.id ? (
                        <p className="mt-2 px-1 text-[10px] text-rose-600">
                          {(voteMut.error as Error)?.message ?? '投票失败'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

    </div>
  )
}
