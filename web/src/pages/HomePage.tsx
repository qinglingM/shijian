import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Search as SearchIcon } from 'lucide-react'
import { useCities } from '@/features/city-picker/useCities'
import {
  useDisplayedTierMap,
  type TierMapItem,
} from '@/features/tier-map/useTierMap'
import { TierMap } from '@/features/tier-map/TierMap'
import { TIER_LABEL, TIER_COLOR_VAR, type Tier } from '@/lib/db'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { useRequireLogin } from '@/features/auth/useRequireLogin'

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
  boom: '#000', hang: '#000', top: '#000',
  upper: '#000', npc: '#000', bad: '#000',
}
function tierTextColor(tier: Tier): string { return TIER_TEXT_COLOR[tier] }

export function HomePage() {
  const navigate = useNavigate()
  const requireLogin = useRequireLogin()
  const { map, isLoading, error } = useDisplayedTierMap()
  const { data: allCities = [] } = useCities()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  useAndroidBackDismiss(filterOpen, () => setFilterOpen(false))
  const [filterTab, setFilterTab] = useState<'city' | 'category'>('city')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null)
  const [appliedCity, setAppliedCity] = useState<string | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null)
  const [pendingCity, setPendingCity] = useState<string | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  // Correlated filter data: when city selected, only show categories in that city
  // and vice versa
  const filteredRestaurants = useMemo(() => {
    return map.buckets.flatMap(b => b.restaurants.filter(r => {
      if (appliedCity && r.city_name !== appliedCity) return false
      if (appliedCategory) {
        const match = r.amap_mid_category === appliedCategory ||
          removeBracketContent(r.amap_small_category || '') === appliedCategory
        if (!match) return false
      }
      return true
    }))
  }, [map, appliedCity, appliedCategory])

  const userCityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of filteredRestaurants) {
      if (r.city_name) ids.add(r.city_name)
    }
    return ids
  }, [filteredRestaurants])

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

  const categoryGroups = useMemo(() => {
    const mids = new Set<string>()
    const smallsMap = new Map<string, Set<string>>()
    for (const r of filteredRestaurants) {
      if (r.amap_mid_category) {
        mids.add(r.amap_mid_category)
        if (r.amap_small_category) {
          const cleaned = removeBracketContent(r.amap_small_category)
          if (!smallsMap.has(r.amap_mid_category)) {
            smallsMap.set(r.amap_mid_category, new Set())
          }
          smallsMap.get(r.amap_mid_category)!.add(cleaned)
        }
      }
    }
    return AMAP_MID_CATEGORIES
      .filter(g => mids.has(g.name))
      .map(g => ({
        name: g.name,
        subs: smallsMap.has(g.name) ? [...smallsMap.get(g.name)!].sort() : [],
      }))
  }, [filteredRestaurants])

  const visibleMap = useMemo(() => {
    const buckets = map.buckets.map(b => {
      let rest = b.restaurants
      if (appliedCity) rest = rest.filter(r => r.city_name === appliedCity)
      if (appliedCategory) {
        rest = rest.filter(r =>
          r.amap_mid_category === appliedCategory ||
          removeBracketContent(r.amap_small_category || '') === appliedCategory
        )
      }
      return { tier: b.tier, count: rest.length, restaurants: rest }
    })
    return { total_count: buckets.reduce((s, b) => s + b.count, 0), buckets }
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

  function handleReset() {
    setSelectedProvince(null)
    setSelectedBigCategory(null)
    if (filterTab === 'city') { setPendingCity(null); setAppliedCity(null) }
    if (filterTab === 'category') { setPendingCategory(null); setAppliedCategory(null) }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="relative bg-neutral-100" style={{ paddingTop: 'var(--safe-top)' }}>
        {/* Header with filters + search + view toggle */}
        <header className="flex items-center justify-between px-4 py-0.5">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">我的食鉴图</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/search')}
              aria-label="搜索"
              className="flex items-center justify-center rounded-full p-1 text-neutral-500 active:bg-neutral-100"
            >
              <SearchIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
              aria-label={viewMode === 'grid' ? '切换为列表视图' : '切换为表格视图'}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-neutral-500 ring-1 ring-neutral-200 active:bg-neutral-50"
            >
              {viewMode === 'grid' ? <List size={13} /> : <LayoutGrid size={13} />}
            </button>
          </div>
        </header>

        {/* Filter buttons row + panel */}
        <div className="relative bg-neutral-50/60">
          <div className="flex items-center gap-2 px-4 pb-1 z-[998] relative">
            <button
              onClick={() => { setPendingCity(appliedCity); setFilterTab('city'); setFilterOpen(true) }}
              className={`text-[13px] font-semibold transition-colors ${
                appliedCity ? 'text-blue-600' : 'text-neutral-500'
              }`}
            >
              {appliedCity || '城市'}
            </button>
            <span className="text-neutral-300 shrink-0">|</span>
            <button
              onClick={() => { setPendingCategory(appliedCategory); setFilterTab('category'); setFilterOpen(true) }}
              className={`text-[13px] font-semibold transition-colors ${
                appliedCategory ? 'text-blue-600' : 'text-neutral-500'
              }`}
            >
              {appliedCategory || '种类'}
            </button>
          </div>

          {/* Filter panel */}
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-[997]" onClick={() => setFilterOpen(false)} />
              <div
                className="absolute top-full left-0 right-0 z-[998] mx-auto max-w-md bg-white shadow-xl rounded-b-2xl overflow-hidden"
                style={{ animation: 'shijian-slide-down 0.2s ease-out' }}
              >
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
                            <button key={name} onClick={() => setPendingCity(pendingCity === name ? null : name)}
                              className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${pendingCity === name ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
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
                            setSelectedBigCategory(g.name)
                            setPendingCategory(g.name)
                          }}
                            className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${selectedBigCategory === g.name ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}>
                            {g.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {(() => {
                          const active = categoryGroups.find(g => g.name === selectedBigCategory)
                          return active ? [null, ...active.subs].map((sub) => (
                            <button key={sub ?? 'all'} onClick={() => setPendingCategory(sub ?? active.name)}
                              className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${pendingCategory === (sub ?? active.name) ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
                              {sub ?? '不限'}
                            </button>
                          )) : null
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-neutral-100 px-4 py-3 flex gap-3">
                  <button onClick={handleReset} className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 text-[14px] font-semibold text-neutral-600 shadow-sm active:bg-neutral-50">重置</button>
                  <button onClick={() => { setAppliedCity(pendingCity); setAppliedCategory(pendingCategory); setFilterOpen(false) }} className="flex-1 rounded-xl bg-blue-500 py-3 text-[14px] font-semibold text-white shadow-sm active:bg-blue-600">确定</button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="px-4 pb-2 text-center text-[12px] text-neutral-500">
          你已在食鉴创下了{' '}
          <span className="font-semibold text-orange-600">{map.total_count}</span>
          {' '}条实践记录
        </p>
      </div>

      <section className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-neutral-400">载入中…</p>
          ) : error ? (
            <p className="py-12 text-center text-sm text-rose-400">
              加载失败，请检查网络后刷新页面
            </p>
          ) : viewMode === 'grid' ? (
            <TierMap buckets={visibleMap.buckets} />
          ) : (
            <TierListView items={flatItems} />
          )}
        </div>

        {viewMode === 'grid' && (
          <button
            type="button"
            onClick={() => {
              if (!requireLogin()) return
              navigate('/practice/step1')
            }}
            className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-3rem)] max-w-md -translate-x-1/2 flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/25 active:opacity-90"
          >
            开始食鉴
          </button>
        )}
      </section>


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
    <ul className="space-y-2 px-[2.5%] pt-3">
      {items.map((item) => {
        const city = item.city_name?.trim() ?? null
        const category = item.category_name?.trim() ?? item.amap_mid_category?.trim() ?? null
        const locationLine = [city, category].filter(Boolean).join(' · ')
        return (
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
                {locationLine && (
                  <p className="mt-0.5 text-[12px] text-neutral-400 truncate">{locationLine}</p>
                )}
              </div>
              <span
                className="shrink-0 w-[3.75rem] rounded-full px-2 py-1.5 text-center text-[11px] font-bold leading-none"
                style={{ background: TIER_COLOR_VAR[item.tier], color: tierTextColor(item.tier) }}
              >
                {TIER_LABEL[item.tier]}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
