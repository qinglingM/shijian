import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CityRow } from '@/lib/db'
import type { CitiesSourceStatus } from '@/features/city-picker/citiesSourceStatus'
import {
  buildProvinceOrderedSections,
  provinceLatinBucketLetter,
} from '@/features/city-picker/provinceMetroOrder'
import { pickHotCityRows } from '@/features/city-picker/constants'
import { cityPickerChipClass } from '@/features/city-picker/cityPickerChipClass'
import { cityPickerChipDisplayName, cityPickerSheetLabel } from '@/features/city-picker/cityPickerSheetLabel'
import { CurrentLocationCitySection } from '@/features/city-picker/CurrentLocationCitySection'
import { useCityStore } from '@/features/city-picker/cityStore'

function normalize(s: string) {
  return s.trim().toLowerCase()
}

const INDEX_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

export function CityPickerSheet({
  open,
  onClose,
  cities,
  sourceStatus,
  controlledCityId,
  controlledCityName,
  controlledShowsAllChina,
  onControlledCityChange,
  onControlledAllChina,
}: {
  open: boolean
  onClose: () => void
  cities: CityRow[]
  sourceStatus: CitiesSourceStatus
  controlledCityId?: string | null
  controlledCityName?: string
  controlledShowsAllChina?: boolean
  onControlledCityChange?: (cityId: string | null, cityName: string) => void
  onControlledAllChina?: () => void
}) {
  const isControlled = onControlledCityChange !== undefined || onControlledAllChina !== undefined
  const storeTierMapShowsAllChina = useCityStore((s) => s.tierMapShowsAllChina)
  const storeLocatedCityId = useCityStore((s) => s.locatedCityId)
  const storeCityId = useCityStore((s) => s.cityId)
  const storeSetConcreteCity = useCityStore((s) => s.setConcreteCity)
  const storeSetTierMapShowsAllChina = useCityStore((s) => s.setTierMapShowsAllChina)

  const tierMapShowsAllChina = isControlled ? (controlledShowsAllChina ?? true) : storeTierMapShowsAllChina
  const cityId = isControlled ? (controlledCityId ?? null) : storeCityId
  const locatedCityId = storeLocatedCityId // 定位城市始终从全局读

  function selectAll() {
    if (isControlled) {
      onControlledAllChina?.()
    } else {
      storeSetTierMapShowsAllChina()
    }
    onClose()
  }

  function selectCity(c: CityRow) {
    if (isControlled) {
      onControlledCityChange?.(c.id, c.name)
    } else {
      storeSetConcreteCity(c.id, c.name)
    }
    onClose()
  }

  const [q, setQ] = useState('')

  const listReady = sourceStatus.kind === 'ok'

  const subtitle = (() => {
    switch (sourceStatus.kind) {
      case 'no_supabase':
        return '未连接：城市数据来自 Supabase'
      case 'loading':
        return '正在从服务器载入城市列表…'
      case 'error':
        return '加载失败，无法显示城市列表'
      case 'empty_db':
        return '已连接，但 cities 表中没有城市（0 条）'
      default:
        return `已载入 ${cities.length} 座城市${
          cities.length > 0 && cities.length < 50
            ? '（若偏少请执行迁移 0008_china_cities_catalog）'
            : ''
        }`
    }
  })()

  const needle = normalize(q)
  const filtered = useMemo(() => {
    if (!needle) return cities
    return cities.filter((c) => {
      const nm = normalize(c.name)
      const pn = normalize(c.name_pinyin ?? '')
      const pv = normalize(c.province_name ?? '')
      return nm.includes(needle) || pn.includes(needle) || pv.includes(needle)
    })
  }, [cities, needle])

  const provinceData = useMemo(
    () => buildProvinceOrderedSections(filtered),
    [filtered],
  )
  const { provinces, byProvince, bucketFirstProvince } = provinceData

  const latinLettersUsed = useMemo(() => {
    const s = new Set<string>()
    for (const pname of provinces) {
      s.add(provinceLatinBucketLetter(pname === '——' ? null : pname))
    }
    return s
  }, [provinces])

  const hot = useMemo(() => {
    const rows = pickHotCityRows(cities)
    const lid = locatedCityId
    if (!lid) return rows
    return rows.filter((c) => c.id !== lid)
  }, [cities, locatedCityId])

  function scrollToProvLatinBucket(letter: string) {
    const el =
      typeof document !== 'undefined'
        ? document.getElementById(`prov-latin-${letter}`)
        : null
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="关闭城市选择"
        className="fixed inset-0 z-40 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="选择城市"
        className="fixed inset-x-0 bottom-0 top-[max(6vh,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(94dvh,100svh)] max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900">选择城市</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-orange-700 active:bg-orange-50"
          >
            完成
          </button>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索城市名、拼音或省份…"
            disabled={!listReady}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
            enterKeyHint="search"
            autoComplete="off"
          />
        </div>

        {sourceStatus.kind === 'no_supabase' ? (
          <div className="shrink-0 px-4 pb-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950">
              <p className="font-semibold">为什么这里是空的？</p>
              <p className="mt-1 text-amber-900/90">
                当前未检测到 Supabase 配置，前端<strong>不会</strong>请求城市接口，列表恒为空。
              </p>
              <p className="mt-2 font-mono text-[11px] text-amber-900/80">
                在 web/.env.local 中设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY
                后重启 dev 服务。
              </p>
            </div>
          </div>
        ) : null}

        {sourceStatus.kind === 'error' ? (
          <div className="shrink-0 px-4 pb-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-950">
              <p className="font-semibold">请求失败</p>
              <p className="mt-1 break-all font-mono text-[11px] opacity-90">
                {sourceStatus.message}
              </p>
              <p className="mt-2 text-[11px] text-rose-900/85">
                若是「column name_pinyin does not exist」，说明尚未执行含 name_pinyin
                的迁移（见 0008）。
              </p>
            </div>
          </div>
        ) : null}

        {sourceStatus.kind === 'empty_db' ? (
          <div className="shrink-0 px-4 pb-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-800">
              <p className="font-semibold">已连上数据库，但没有城市数据</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                请在 Supabase SQL 中依次执行迁移里的「cities」种子与
                0008_china_cities_catalog.sql，或在本地 supabase db push。
              </p>
            </div>
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pl-4 pr-7 pb-8 [scrollbar-gutter:stable]">
            <button
              type="button"
              onClick={selectAll}
              className={`mb-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors active:bg-neutral-50 ${
                tierMapShowsAllChina
                  ? 'border-orange-300 bg-orange-50/70'
                  : 'border-neutral-100 bg-neutral-50/70'
              }`}
            >
              <span className="text-base font-semibold text-neutral-900">
                全部（食鉴图不按城筛选）
              </span>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-100">
                全国
              </span>
            </button>

            <CurrentLocationCitySection
              cities={cities}
              disabled={!listReady}
              selectedCityId={cityId}
              tierMapShowsAllChina={tierMapShowsAllChina}
              onSelectCity={selectCity}
            />

            {hot.length > 0 ? (
              <div className="mb-6">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  热门城市
                </p>
                <div className="flex flex-wrap gap-2 pr-6">
                  {hot.map((c) => {
                    const selected = !tierMapShowsAllChina && c.id === cityId
                    const full = cityPickerSheetLabel(c)
                    const chipText = cityPickerChipDisplayName(c)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCity(c)}
                        title={`${full}${selected ? ' · 当前选中' : ''}`}
                        className={cityPickerChipClass(selected)}
                      >
                        {chipText}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {listReady ? (
              <Fragment>
                {needle ? (
                  <p className="mb-3 text-[12px] text-neutral-500">
                    「{needle}」命中 {filtered.length} 座城市（在全部 {cities.length}{' '}
                    座内）
                  </p>
                ) : (
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    城市列表 · 省份按拉丁 A–Z · 地级市优先 · 省会置顶 · 其余按拼音首字母
                  </p>
                )}

                {provinces.map((pname) => {
                  const bucketLetter = provinceLatinBucketLetter(pname === '——' ? null : pname)
                  const isLatinBucketHead =
                    pname === bucketFirstProvince[bucketLetter]
                  const list = byProvince.get(pname) ?? []
                  const provinceLabel =
                    pname === '——' ? '未标明省份' : pname
                  const showLatinAnchor = !needle && isLatinBucketHead

                  return (
                    <div key={pname} className="mb-3 scroll-mt-2">
                      {!needle ? (
                        <div
                          id={
                            showLatinAnchor
                              ? `prov-latin-${bucketLetter}`
                              : undefined
                          }
                          className="sticky top-0 z-[1] -mx-1 mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-white/95 px-1 py-1 backdrop-blur-sm"
                        >
                          {showLatinAnchor ? (
                            <span className="shrink-0 text-[13px] font-bold text-orange-950">
                              {bucketLetter}
                            </span>
                          ) : null}
                          <span className="min-w-0 text-[11px] font-semibold tracking-tight text-neutral-700">
                            {provinceLabel}
                            <span className="ml-1 font-normal tabular-nums text-neutral-400">
                              {list.length}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <p className="mb-1.5 text-[11px] font-semibold text-neutral-700">
                          {provinceLabel}
                          <span className="ml-1 font-normal tabular-nums text-neutral-400">{list.length}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pr-6 pb-1">
                        {list.map((c) => {
                          const selected = !tierMapShowsAllChina && c.id === cityId
                          const full = cityPickerSheetLabel(c)
                          const chipText = cityPickerChipDisplayName(c)
                          const tip =
                            needle && c.province_name
                              ? `${full} · ${c.province_name}`
                              : full
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCity(c)}
                              className={cityPickerChipClass(selected)}
                              title={tip}
                            >
                              {chipText}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {needle && filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-400">
                    没有匹配的城市
                  </p>
                ) : null}
              </Fragment>
            ) : sourceStatus.kind === 'loading' ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                正在拉取城市列表…
              </p>
            ) : (
              <p className="py-6 text-center text-[13px] leading-relaxed text-neutral-500">
                选择具体城市前，请先按上方说明完成 Supabase 配置或数据库迁移。
                你仍可使用顶部「全部」让食鉴图按全国展示。
              </p>
            )}
          </div>

          {!needle && listReady && latinLettersUsed.size > 1 ? (
            <aside className="pointer-events-auto absolute right-1.5 bottom-16 top-[calc(9rem+env(safe-area-inset-bottom))] z-[2] flex w-5 flex-col justify-between overflow-y-auto py-2 text-[9px] font-bold leading-tight text-orange-950/95">
              {INDEX_LETTERS.map((letter) => {
                const has = latinLettersUsed.has(letter)
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() =>
                      has ? scrollToProvLatinBucket(letter) : undefined
                    }
                    disabled={!has}
                    className="shrink-0 rounded px-0.5 py-0.5 text-orange-950/95 disabled:pointer-events-none disabled:text-neutral-300"
                  >
                    {letter}
                  </button>
                )
              })}
            </aside>
          ) : null}
        </div>
      </div>
    </>
  )
}
