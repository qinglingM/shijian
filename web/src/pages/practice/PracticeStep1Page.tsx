import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { CityPicker } from '@/features/city-picker/CityPicker'
import { useCityStore } from '@/features/city-picker/cityStore'
import {
  lookupExistingRestaurantByPoi,
  usePoiSearch,
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

export function PracticeStep1Page() {
  const navigate = useNavigate()
  const setPoi = usePracticeDraft((s) => s.setPoi)
  const applyHydrated = usePracticeDraft((s) => s.applyHydratedPracticeFromServer)
  const resetDraft = usePracticeDraft((s) => s.reset)
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  const cityName = useCityStore((s) => s.cityName)

  useEffect(() => {
    resetDraft()
  }, [resetDraft])

  const [keyword, setKeyword] = useState('')
  const [picking, setPicking] = useState<string | null>(null)
  const userLoc = useUserLocation()
  const { data: rawCandidates = [], isLoading, isFetching } = usePoiSearch(keyword, cityName)

  const candidates = useMemo<PoiCandidate[]>(() => {
    if (!userLoc || rawCandidates.length === 0) return rawCandidates
    return [...rawCandidates].sort((a, b) => {
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
  }, [rawCandidates, userLoc])

  const practicedQ = useCandidatesPracticeStatus(candidates)
  const emptyPracticed = useMemo(() => new Set<string>(), [])
  const practicedPoiKeys = practicedQ.data ?? emptyPracticed

  const showInitialHint = keyword.trim() === ''
  const showNoResults =
    !showInitialHint && !isLoading && !isFetching && candidates.length === 0

  async function selectPoi(poi: PoiCandidate) {
    setPicking(poi.poi_id)
    try {
      const existingId = await lookupExistingRestaurantByPoi(
        poi.poi_source,
        poi.poi_id,
      )
      let existingPracticePayload = null
      if (viewerId && existingId) {
        try {
          existingPracticePayload = await fetchExistingPracticeHydration(
            viewerId,
            existingId,
          )
        } catch (e) {
          console.warn('[shijian] hydrate practice draft failed:', e)
        }
      }
      const willReplace =
        !!existingPracticePayload || practicedPoiKeys.has(poiPracticeKey(poi))
      setPoi(poi, existingId, willReplace)
      if (existingPracticePayload) applyHydrated(existingPracticePayload)
      navigate('/practice/step2')
    } finally {
      setPicking(null)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <BackHeader title="搜索确认店铺" backTo="/tier-map" />

      {/* 搜索区：背景固定不变，与下方结果区区分 */}
      <section className="shrink-0 bg-[radial-gradient(120%_85%_at_50%_0%,#f9fafb_0%,#f1f5f9_45%,#e8eef5_100%)] px-4 pt-5 pb-4">
        <div className="mx-auto mt-1 flex max-w-[22rem] items-center gap-3 sm:max-w-none">
          <CityPicker variant="practiceRow" />
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
              strokeWidth={2.2}
            />
            <input
              type="search"
              enterKeyHint="search"
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={`在 ${cityName} 搜店名、地址`}
              className="w-full rounded-full bg-neutral-100 py-2.5 pr-4 pl-10 text-sm outline-none ring-orange-400/0 transition-[box-shadow,background-color] placeholder:text-neutral-400 focus-visible:bg-neutral-200/80 focus-visible:ring-2 focus-visible:ring-orange-400/35 active:bg-neutral-200/90"
            />
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-[22rem] items-center justify-end gap-2 text-[11px] text-neutral-500 sm:max-w-none">
          {(isLoading || isFetching) && !showInitialHint && (
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

        {(isLoading || isFetching) && !showInitialHint && (
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
                找到 <span className="tabular-nums text-orange-700">{candidates.length}</span> 个候选，点击选定后进入写评价
              </p>
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
                      disabled={picking === poi.poi_id}
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

              <li className="pt-2 pb-6 text-center text-[11px] text-neutral-400">
                没有找到这家店？{' '}
                <Link to="/practice/manual" className="text-neutral-700 underline">
                  手动补充
                </Link>
              </li>
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
