import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Search, ChevronDown } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { useCities } from '@/features/city-picker/useCities'
import { useDebounce } from '@/lib/useDebounce'
import {
  lookupExistingRestaurantByPoi,
  usePoiSearchInfinite,
} from '@/features/poi-search/usePoiSearch'
import { useCandidatesPracticeStatus } from '@/features/poi-search/useCandidatesPracticeStatus'
import { fetchExistingPracticeHydration } from '@/features/practice/hydratePracticeDraftFromServer'
import { usePracticeDraft } from '@/stores/practiceDraft'
import { useAuthStore } from '@/stores/authStore'
import type { PoiCandidate } from '@/lib/poi'
import { PracticeStep1SloganImage } from './PracticeStep1SloganImage'
import { poiPracticeKey } from '@/features/poi-search/poiPracticeKey'
import { useUserLocation } from '@/hooks/useUserLocation'
import { distanceKm } from '@/lib/geo'

const PAGE_SIZE = 20

export function PracticeStep1Page() {
  const navigate = useNavigate()
  const setPoi = usePracticeDraft((s) => s.setPoi)
  const resetDraft = usePracticeDraft((s) => s.reset)
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  const [searchCity, setSearchCity] = useState<{ id: string | null; name: string }>({ id: null, name: '' })

  useEffect(() => {
    resetDraft()
  }, [resetDraft])

  const [keyword, setKeyword] = useState('')
  const [cityFilterOpen, setCityFilterOpen] = useState(false)
  useAndroidBackDismiss(cityFilterOpen, () => setCityFilterOpen(false))
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const debouncedKeyword = useDebounce(keyword, 300)
  const citiesQuery = useCities()
  const cityRows = citiesQuery.data ?? []

  const provinces = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of cityRows) {
      const p = c.province_name?.trim() || '其他'
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(c.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
  }, [cityRows])
  const sentinelRef = useRef<HTMLLIElement>(null)

  const userLoc = useUserLocation()
  const searchCityForApi = searchCity.name || undefined
  const {
    data: searchData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePoiSearchInfinite(debouncedKeyword, searchCityForApi)

  // 每页各自由近及远排序，再按加载顺序拼接——不跨页重排
  const candidates = useMemo<PoiCandidate[]>(() => {
    const pages = searchData?.pages ?? []
    const sortByDistance = (items: PoiCandidate[]) => {
      if (!userLoc) return items
      return [...items].sort((a, b) => {
        const da =
          a.latitude != null && a.longitude != null
            ? distanceKm(userLoc.lat, userLoc.lng, a.latitude, a.longitude)
            : Infinity
        const db =
          b.latitude != null && b.longitude != null
            ? distanceKm(userLoc.lat, userLoc.lng, b.latitude, b.longitude)
            : Infinity
        return da - db
      })
    }
    return pages.flatMap((p) => sortByDistance(p.items))
  }, [searchData, userLoc])

  const total = searchData?.pages[0]?.total ?? 0

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const practicedQ = useCandidatesPracticeStatus(candidates)
  // data 为 string[]，转成 Set 供 .has 查询。Array.isArray 兜底旧版持久化缓存里残留的非数组数据。
  const practicedPoiKeys = useMemo(
    () => new Set(Array.isArray(practicedQ.data) ? practicedQ.data : []),
    [practicedQ.data],
  )

  const showInitialHint = keyword.trim() === ''
  const showNoResults =
    !showInitialHint && !isLoading && !isFetchingNextPage && candidates.length === 0

  function selectPoi(poi: PoiCandidate) {
    // 先用 POI 基础信息立即跳转，消除点击到进入 step2 的卡顿
    setPoi(poi, null, false)
    navigate('/practice/step2')

    // 后台静默补全：查询已有餐厅 id 和历史评价，完成后 patch 到 draft
    const capturedPracticedPoiKeys = practicedPoiKeys
    void (async () => {
      try {
        const existingId = await lookupExistingRestaurantByPoi(
          poi.poi_source,
          poi.poi_id,
        )
        const willReplace =
          !!existingId && capturedPracticedPoiKeys.has(poiPracticeKey(poi))
        usePracticeDraft.getState().patchExistingRestaurant(existingId, willReplace)

        if (viewerId && existingId) {
          const payload = await fetchExistingPracticeHydration(viewerId, existingId)
          // 只有用户尚未开始填写（tier 仍为 null）时才回填历史评价
          if (payload) {
            const s = usePracticeDraft.getState()
            if (s.tier === null && !s.submission_baseline_locked_from_server) {
              s.applyHydratedPracticeFromServer(payload)
            }
          }
        }
      } catch (e) {
        console.warn('[shijian] background poi lookup failed:', e)
      }
    })()
  }

  function shortenCityName(name: string | null): string {
    if (!name) return '全国'
    return name.replace(/市$/, '').slice(0, 4)
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <BackHeader title="搜索确认店铺" backTo="/tier-map" />

      {/* 搜索区：背景固定不变，与下方结果区区分 */}
      <section className="shrink-0 bg-[radial-gradient(120%_85%_at_50%_0%,#f9fafb_0%,#f1f5f9_45%,#e8eef5_100%)] px-4 py-2">
        <div className="mx-auto flex max-w-[22rem] items-center gap-2 sm:max-w-none">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCityFilterOpen(!cityFilterOpen)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 active:bg-neutral-200"
            >
              <ChevronDown size={14} strokeWidth={2} />
              {shortenCityName(searchCity.name)}
            </button>

            {cityFilterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCityFilterOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-40 w-72 rounded-xl bg-white shadow-xl ring-1 ring-black/[0.06] overflow-hidden">
                  <div className="flex" style={{ height: '30dvh' }}>
                    <div className="w-[120px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                      {provinces.map(([pname]) => (
                        <button
                          key={pname}
                          onClick={() => setSelectedProvince(selectedProvince === pname ? null : pname)}
                          className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${selectedProvince === pname ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}
                        >
                          {pname}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {(() => {
                        const cities = selectedProvince ? provinces.find(([p]) => p === selectedProvince)?.[1] ?? [] : []
                        return cities.length > 0 ? cities.map((name) => (
                          <button
                            key={name}
                            onClick={() => { setSearchCity({ id: null, name }); setCityFilterOpen(false) }}
                            className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${searchCity.name === name ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}
                          >
                            {name}
                          </button>
                        )) : <p className="px-3 py-6 text-center text-[11px] text-neutral-400">请先选择省份</p>
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-1 items-center gap-1.5">
            <Search size={14} className="shrink-0 text-neutral-400" aria-hidden />
            <input
              type="search"
              enterKeyHint="search"
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={`${searchCity.name ? `在 ${searchCity.name}` : '全国'}搜店名、地址`}
              className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none py-1"
            />
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-[22rem] items-center justify-end gap-2 text-[11px] text-neutral-500 sm:max-w-none">
          {isLoading && !showInitialHint && (
            <span className="shrink-0 font-medium text-neutral-700">搜寻中…</span>
          )}
        </div>
      </section>

      {/* 结果展示区：单独底色与顶部分界，仅此处随状态变化呈现「内容面板」感 */}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-t-[1.35rem] border-t border-slate-200/80 bg-gradient-to-b from-orange-50/[0.97] via-amber-50/35 to-[#ece8e3] px-4 pt-5 shadow-[0_-8px_36px_rgba(15,23,42,0.06)]">
        {showInitialHint ? (
          <div className="relative flex flex-1 flex-col items-center justify-center px-3 pb-14 pt-2">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute -left-[10%] top-[20%] h-44 w-44 rounded-full bg-orange-400/18 blur-3xl" />
              <div className="absolute -right-[6%] bottom-[26%] h-40 w-52 rounded-full bg-sky-400/14 blur-3xl" />
              <div className="absolute left-1/2 top-[12%] h-px w-[min(72%,20rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-300/35 to-transparent" />
            </div>
            <div className="relative z-10 w-full max-w-[min(92vw,26rem)]">
              <PracticeStep1SloganImage className="w-full" />
            </div>
          </div>
        ) : null}

        {isLoading && !showInitialHint && (
          <div className="rounded-[1.5rem] border border-orange-100 bg-gradient-to-b from-orange-50/70 to-white px-4 py-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-white text-orange-600 shadow-inner ring-1 ring-orange-100">
              <Search size={20} className="animate-pulse" />
            </div>
            <p className="text-sm font-medium text-neutral-800">正在沿着线索找店</p>
            <p className="mt-1 text-xs text-neutral-400">匹配真实 POI 候选中...</p>
          </div>
        )}

        {candidates.length > 0 && (
          <div>
            <div className="mb-3 flex items-end justify-between">
              <p className="text-[12px] font-medium text-neutral-600">
                找到 <span className="tabular-nums text-orange-700">{total}</span> 个候选，点击选定后进入写评价
              </p>
              {total > PAGE_SIZE && (
                <p className="text-[11px] text-neutral-400">
                  已显示 {candidates.length}/{total}
                </p>
              )}
            </div>
            <ul className="space-y-3">
              {candidates.map((poi) => {
                const practicedHere = practicedPoiKeys.has(poiPracticeKey(poi))
                const region = [poi.city_name, poi.district_name].filter(Boolean).join(' ') || '区域未知'
                const address = poi.address_text?.trim() || '地址未录入'
                return (
                  <li key={poi.poi_id}>
                    <button
                      type="button"
                      onClick={() => selectPoi(poi)}
                      className="w-full rounded-2xl border border-neutral-100 bg-white p-3 text-left shadow-sm active:bg-neutral-50 disabled:opacity-50"
                    >
                      <div className="flex gap-3">
                        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                          {poi.cover_image_url ? (
                            <img src={poi.cover_image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <MapPin className="size-6 text-orange-500" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">
                              {poi.poi_name}
                            </h3>
                            {practicedHere && (
                              <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                                已评过
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              {region}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-neutral-500">
                            {address}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}

              {hasNextPage ? (
                <li ref={sentinelRef} className="py-4 text-center text-[11px] text-neutral-400">
                  {isFetchingNextPage ? '加载中…' : '上拉加载更多…'}
                </li>
              ) : (
                <li className="pt-2 pb-6 text-center text-[11px] text-neutral-400">
                  没有找到这家店？{' '}
                  <Link to="/practice/manual" className="text-neutral-700 underline">
                    手动补充
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {showNoResults && (
          <div className="rounded-[1.7rem] border border-dashed border-orange-300/85 bg-orange-50/40 px-4 py-10 text-center shadow-sm">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-white text-orange-600 ring-1 ring-orange-100">
              <MapPin size={20} />
            </div>
            <p className="text-sm font-medium text-neutral-800">这条线索还没找到真店</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              可以换个关键词，或把这家店手动补进本次食鉴。
            </p>
            <Link
              to="/practice/manual"
              className="mt-5 inline-block rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-orange-700/25"
            >
              手动补充店铺
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
