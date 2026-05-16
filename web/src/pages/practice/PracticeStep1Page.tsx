import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, MapPin, Search } from 'lucide-react'
import { BackHeader, PracticeProgress } from '@/components/layout/AppLayout'
import { CityPicker } from '@/features/city-picker/CityPicker'
import { useCityStore } from '@/features/city-picker/cityStore'
import {
  lookupExistingRestaurantByPoi,
  usePoiSearch,
} from '@/features/poi-search/usePoiSearch'
import { useCandidatesPracticeStatus } from '@/features/poi-search/useCandidatesPracticeStatus'
import {
  PracticeRestaurantDragCard,
  PracticeRestaurantDragRow,
  practiceDisplayFromPoiCandidate,
} from '@/features/practice/PracticeRestaurantCard'
import { fetchExistingPracticeHydration } from '@/features/practice/hydratePracticeDraftFromServer'
import { usePracticeDraft } from '@/stores/practiceDraft'
import { getSupabase } from '@/lib/supabase'
import type { PoiCandidate } from '@/lib/poi'
import { useAuthStore } from '@/stores/authStore'
import { PracticeStep1SloganImage } from './PracticeStep1SloganImage'
import { poiPracticeKey } from '@/features/poi-search/poiPracticeKey'

export function PracticeStep1Page() {
  const navigate = useNavigate()
  const setPoi = usePracticeDraft((s) => s.setPoi)
  const applyHydrated = usePracticeDraft((s) => s.applyHydratedPracticeFromServer)
  const cityName = useCityStore((s) => s.cityName)

  const [keyword, setKeyword] = useState('')
  const [picking, setPicking] = useState<string | null>(null)
  const { data: candidates = [], isLoading, isFetching } = usePoiSearch(keyword, cityName)
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
      const userId = useAuthStore.getState().user?.id ?? null
      let willReplace = false
      if (existingId && userId) {
        const { data, error } = await getSupabase()
          .from('practice_records')
          .select('id')
          .eq('user_id', userId)
          .eq('restaurant_id', existingId)
          .eq('is_active', true)
          .maybeSingle()
        if (!error) willReplace = !!data
      }
      setPoi(poi, existingId, willReplace)

      if (willReplace && existingId && userId) {
        try {
          const payload = await fetchExistingPracticeHydration(userId, existingId)
          if (payload) applyHydrated(payload)
        } catch (e) {
          console.warn('[shijian] hydrate practice draft failed:', e)
        }
      }

      navigate('/practice/step2')
    } finally {
      setPicking(null)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <BackHeader title="搜索确认店铺" />
      <PracticeProgress current={1} />

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

        <div className="mx-auto mt-3 flex max-w-[22rem] items-center justify-between gap-2 text-[11px] text-neutral-500 sm:max-w-none">
          <span>POI 候选只用于确认，不会立刻入库</span>
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
              <div>
                <p className="text-sm font-semibold text-neutral-900">可能就是它</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  选中后进入定档，不会立即公开
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-900">
                {candidates.length} 个候选
              </span>
            </div>
            <ul className="space-y-3">
              {candidates.map((poi) => {
                const practicedHere = practicedPoiKeys.has(poiPracticeKey(poi))
                return (
                  <li
                    key={poi.poi_id}
                    className="list-none flex w-full min-w-0 items-center gap-2 pr-2 sm:pr-3"
                  >
                    <PracticeRestaurantDragRow fullWidth>
                      <PracticeRestaurantDragCard
                        display={practiceDisplayFromPoiCandidate(poi)}
                      />
                    </PracticeRestaurantDragRow>
                    <button
                      type="button"
                      disabled={picking === poi.poi_id || practicedQ.isPending}
                      onClick={() => selectPoi(poi)}
                      aria-label={
                        practicedHere ? '你已评过这家店，点此更新食鉴' : '选这家店开始食鉴'
                      }
                      title={practicedHere ? '已评过 · 点此继续' : '就是这家'}
                      className={`ml-auto flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-45 ${
                        practicedHere
                          ? 'bg-gradient-to-br from-orange-600 to-rose-600 text-white shadow-md shadow-orange-700/25'
                          : 'border-[2.5px] border-orange-500 bg-white text-orange-600 shadow-sm shadow-orange-900/12'
                      }`}
                    >
                      <Check strokeWidth={2.5} size={20} className={picking === poi.poi_id ? 'animate-pulse' : ''} />
                    </button>
                  </li>
                )
              })}

              {/* 底部弱提示：手动补充入口（有结果时低调） */}
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
