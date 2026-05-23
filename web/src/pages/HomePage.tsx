import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LayoutGrid, List, Search as SearchIcon } from 'lucide-react'
import { useCities } from '@/features/city-picker/useCities'
import {
  useDisplayedTierMap,
  type TierMapItem,
} from '@/features/tier-map/useTierMap'
import { TierMap } from '@/features/tier-map/TierMap'
import { TIER_LABEL, TIER_COLOR_VAR, type Tier } from '@/lib/db'
import type { TierMapDemoStore } from '@/features/tier-map/tierMapDemoStore'
import { useTierMapDemoStore } from '@/features/tier-map/tierMapDemoStore'

const AMAP_MID_CATEGORIES: { name: string; subs: string[] }[] = [
  {
    name: '中餐厅',
    subs: ['综合酒楼','四川菜','广东菜','山东菜','江苏菜','浙江菜','上海菜','湖南菜','安徽菜','福建菜','北京菜','湖北菜','东北菜','云贵菜','西北菜','老字号','海鲜酒楼','中式素菜馆','清真菜馆','台湾菜','潮州菜','火锅店','特色/地方风味餐厅']
      .map(s => removeBracketContent(s)),
  },
  {
    name: '外国餐厅',
    subs: ['西餐厅','日本料理','韩国料理','法式菜品餐厅','意式菜品餐厅','泰国/越南菜品餐厅','地中海风格菜品','美式风味','印度风味','英国式菜品餐厅','牛扒店','俄国菜','葡国菜','德国菜','巴西菜','墨西哥菜','其它亚洲菜']
      .map(s => removeBracketContent(s)),
  },
  { name: '快餐厅', subs: [] },
  { name: '休闲餐饮场所', subs: [] },
  { name: '咖啡厅', subs: [] },
  { name: '茶艺馆', subs: [] },
  { name: '冷饮店', subs: [] },
  { name: '糕饼店', subs: [] },
  { name: '甜品店', subs: [] },
  { name: '餐饮相关场所', subs: [] },
]

function removeBracketContent(name: string): string {
  return name.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
}

type ViewMode = 'grid' | 'list'

interface FlatItem extends TierMapItem {
  tier: Tier
}

const TIER_TEXT_COLOR: Record<Tier, string> = {
  boom: '#fff', hang: '#fff', top: '#fff',
  upper: '#5a4a00', npc: '#6b5a3a', bad: '#999',
}
function tierTextColor(tier: Tier): string { return TIER_TEXT_COLOR[tier] }

export function HomePage() {
  const navigate = useNavigate()
  const manualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.manualShowDemo)
  const setManualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.setManualShowDemo)
  const { map, showingDemo, isLoading, error } = useDisplayedTierMap()
  const { data: allCities = [] } = useCities()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'city' | 'category'>('city')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null)
  const [appliedCity, setAppliedCity] = useState<string | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null)

  // Cities data (only cities that have user's practice records)
  const userCityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of map.buckets) {
      for (const r of b.restaurants) {
        if (r.city_name) ids.add(r.city_name)
      }
    }
    return ids
  }, [map])

  const provinces = useMemo(() => {
    const mapProv = new Map<string, string[]>()
    for (const c of allCities) {
      if (!userCityIds.has(c.name)) continue
      const p = c.province_name?.trim() || '其他'
      if (!mapProv.has(p)) mapProv.set(p, [])
      mapProv.get(p)!.push(c.name)
    }
    return Array.from(mapProv.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
  }, [allCities, userCityIds])

  // Categories from user's practice data
  const categoryGroups = useMemo(() => {
    const mids = new Set<string>()
    for (const b of map.buckets) {
      for (const r of b.restaurants) {
        if (r.amap_mid_category) mids.add(r.amap_mid_category)
      }
    }
    return AMAP_MID_CATEGORIES.filter(g => mids.has(g.name))
  }, [map])

  const visibleMap = useMemo(() => {
    let buckets = map.buckets.map(b => ({
      ...b,
      restaurants: appliedCity
        ? b.restaurants.filter(r => r.city_name === appliedCity)
        : b.restaurants,
    }))
    if (appliedCategory) {
      buckets = buckets.map(b => ({
        ...b,
        restaurants: b.restaurants.filter(r =>
          r.amap_mid_category === appliedCategory ||
          removeBracketContent(r.amap_small_category || '') === appliedCategory
        ),
      }))
    }
    return { ...map, buckets }
  }, [map, appliedCity, appliedCategory])

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = visibleMap.buckets.flatMap(b =>
      b.restaurants.map(r => ({ ...r, tier: b.tier }))
    )
    return items.sort((a, b) => {
      if (!a.practiced_at && !b.practiced_at) return 0
      if (!a.practiced_at) return 1
      if (!b.practiced_at) return -1
      return b.practiced_at.localeCompare(a.practiced_at)
    })
  }, [visibleMap.buckets])

  const totalCount = visibleMap.buckets.reduce((s, b) => s + b.restaurants.length, 0)

  function handleReset() {
    setSelectedProvince(null)
    setSelectedBigCategory(null)
    if (filterTab === 'city') setAppliedCity(null)
    if (filterTab === 'category') setAppliedCategory(null)
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      {/* Header with filters + search + view toggle */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => { setFilterTab('city'); setFilterOpen(true) }}
            className={`rounded-lg px-2 py-1 text-[12px] font-medium transition-colors ${
              filterTab === 'city' && filterOpen
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                : appliedCity
                  ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                  : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {appliedCity || '城市'}
          </button>
          <button
            onClick={() => { setFilterTab('category'); setFilterOpen(true) }}
            className={`rounded-lg px-2 py-1 text-[12px] font-medium transition-colors ${
              filterTab === 'category' && filterOpen
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                : appliedCategory
                  ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                  : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {appliedCategory || '中类'}
          </button>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">食鉴图</h1>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="搜索"
            className="flex items-center justify-center rounded-full p-1.5 text-neutral-500 active:bg-neutral-100"
          >
            <SearchIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
            aria-label={viewMode === 'grid' ? '切换为列表视图' : '切换为表格视图'}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 ring-1 ring-neutral-200 active:bg-neutral-50"
          >
            {viewMode === 'grid' ? <List size={14} /> : <LayoutGrid size={14} />}
            <span className="tabular-nums">{totalCount}</span>
          </button>
        </div>
      </header>

      {/* Filter panel */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 z-[997]" onClick={() => setFilterOpen(false)} />
          <div className="relative z-[998] mx-auto max-w-md bg-white shadow-xl rounded-b-2xl overflow-hidden" style={{ animation: 'shijian-slide-down 0.2s ease-out' }}>
            <div className="overflow-y-auto" style={{ maxHeight: '45dvh' }}>
              {filterTab === 'city' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {provinces.map(([pname]) => (
                      <button key={pname} onClick={() => setSelectedProvince(selectedProvince === pname ? null : pname)}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${selectedProvince === pname ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}>
                        {pname}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const cities = selectedProvince ? provinces.find(([p]) => p === selectedProvince)?.[1] ?? [] : []
                      return cities.length > 0 ? cities.map((name) => (
                        <button key={name} onClick={() => setAppliedCity(appliedCity === name ? null : name)}
                          className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${appliedCity === name ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
                          {name}
                        </button>
                      )) : <p className="px-4 py-6 text-center text-[12px] text-neutral-400">请先选择省份</p>
                    })()}
                  </div>
                </div>
              )}
              {filterTab === 'category' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {categoryGroups.map((g) => (
                      <button key={g.name} onClick={() => {
                        if (selectedBigCategory === g.name) {
                          setSelectedBigCategory(null); setAppliedCategory(null)
                        } else {
                          setSelectedBigCategory(g.name); setAppliedCategory(g.name)
                        }
                      }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${selectedBigCategory === g.name ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const active = categoryGroups.find(g => g.name === selectedBigCategory)
                      return active && active.subs.length > 0 ? active.subs.map((sub) => (
                        <button key={sub} onClick={() => setAppliedCategory(appliedCategory === sub ? null : sub)}
                          className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${appliedCategory === sub ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
                          {sub}
                        </button>
                      )) : <p className="px-4 py-6 text-center text-[12px] text-neutral-400">请先选择大类</p>
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-neutral-100 px-4 py-3 flex gap-3">
              <button onClick={handleReset} className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 text-[14px] font-semibold text-neutral-600 shadow-sm active:bg-neutral-50">重置</button>
              <button onClick={() => setFilterOpen(false)} className="flex-1 rounded-xl bg-blue-500 py-3 text-[14px] font-semibold text-white shadow-sm active:bg-blue-600">确定</button>
            </div>
          </div>
        </>
      )}

      <section className="flex-1 px-4">
        {isLoading && !showingDemo ? (
          <p className="py-12 text-center text-sm text-neutral-400">载入中…</p>
        ) : error && !showingDemo ? (
          <p className="py-12 text-center text-sm text-rose-400">
            读取失败：{(error as Error).message}
          </p>
        ) : viewMode === 'grid' ? (
          <TierMap buckets={visibleMap.buckets} />
        ) : (
          <TierListView items={flatItems} />
        )}

        <Link
          to="/practice/step1"
          className="mt-4 mb-2 flex w-full items-center justify-center rounded-2xl bg-neutral-900 py-3.5 text-sm font-medium text-white active:bg-neutral-700"
        >
          开始食鉴
        </Link>
      </section>

      <div className="px-5 pt-4 pb-2">
        {manualShowDemo ? (
          <p className="text-center text-[11px] text-amber-700">
            当前为示例数据视图，仅用于查看 UI 状态
          </p>
        ) : null}
        {import.meta.env.DEV ? (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setManualShowDemo(!manualShowDemo)}
              aria-label={manualShowDemo ? '关闭示例数据' : '查看示例数据'}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-neutral-400 ring-1 ring-neutral-200 active:bg-neutral-50"
              title={manualShowDemo ? '关闭示例 UI' : '查看示例 UI'}
            >
              {manualShowDemo ? <EyeOff size={13} /> : <Eye size={13} />}
              示例数据
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TierListView({ items }: { items: FlatItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-neutral-400">还没有食鉴记录</p>
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/restaurants/${item.id}`}
            className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm active:bg-neutral-50"
          >
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="px-1 text-center text-[10px] font-semibold leading-tight text-neutral-400">
                  {item.display_name.slice(0, 4)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-neutral-950">{item.display_name}</p>
              {item.practiced_at && (
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  {new Date(item.practiced_at).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
            <span
              className="shrink-0 w-[3.5rem] text-center rounded-full px-1.5 py-1 text-[11px] font-semibold leading-none"
              style={{ background: TIER_COLOR_VAR[item.tier], color: tierTextColor(item.tier) }}
            >
              {TIER_LABEL[item.tier]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
