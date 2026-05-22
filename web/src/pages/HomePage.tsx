import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, LayoutGrid, List, Search as SearchIcon, X } from 'lucide-react'
import { useUserLocation } from '@/hooks/useUserLocation'
import { distanceKm } from '@/lib/geo'
import { CityPicker } from '@/features/city-picker/CityPicker'
import { TierMapCategoryFilter } from '@/features/tier-map/TierMapCategoryFilter'
import { TierMap } from '@/features/tier-map/TierMap'
import {
  type TierMapDemoStore,
  useTierMapDemoStore,
} from '@/features/tier-map/tierMapDemoStore'
import {
  TIER_MAP_UNCATEGORIZED_FILTER,
  filterTierMapByCategory,
  summarizeTierMapCategoryKeys,
  useDisplayedTierMap,
  type TierMapItem,
} from '@/features/tier-map/useTierMap'
import { useCategories } from '@/features/categories/useCategories'
import { TIER_LABEL, TIER_COLOR_VAR, type Tier } from '@/lib/db'

type ViewMode = 'grid' | 'list'

interface FlatItem extends TierMapItem {
  tier: Tier
}

export function HomePage() {
  const manualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.manualShowDemo)
  const setManualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.setManualShowDemo)
  const { map, showingDemo, isLoading, error } = useDisplayedTierMap()
  const categoriesQ = useCategories()

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const userLoc = useUserLocation()

  const { categoryIds, hasUncategorized } = useMemo(
    () => summarizeTierMapCategoryKeys(map.buckets),
    [map.buckets],
  )

  const categoryCatalog = useMemo(
    () => (categoriesQ.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [categoriesQ.data],
  )

  const displayCategoryFilter = useMemo(() => {
    const f = categoryFilter
    if (f === null) return null
    if (f === TIER_MAP_UNCATEGORIZED_FILTER)
      return hasUncategorized ? f : null

    const catalogIds = new Set(categoryCatalog.map((c) => c.id))
    return catalogIds.has(f) || categoryIds.has(f) ? f : null
  }, [categoryFilter, categoryIds, hasUncategorized, categoryCatalog])

  const displayMap = useMemo(
    () => filterTierMapByCategory(map, displayCategoryFilter),
    [map, displayCategoryFilter],
  )

  const searchedMap = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return displayMap

    const sortByDist = <T extends { latitude: number | null; longitude: number | null }>(
      items: T[],
    ): T[] => {
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

    const filteredBuckets = displayMap.buckets.map((b) => {
      const filtered = b.restaurants.filter((r) =>
        r.display_name.toLowerCase().includes(q),
      )
      return { ...b, restaurants: sortByDist(filtered) }
    })
    return {
      ...displayMap,
      buckets: filteredBuckets,
      total_count: filteredBuckets.reduce((n, b) => n + b.restaurants.length, 0),
    }
  }, [displayMap, searchQuery, userLoc])

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = searchedMap.buckets.flatMap((b) =>
      b.restaurants.map((r) => ({ ...r, tier: b.tier })),
    )
    if (searchQuery.trim() && userLoc) {
      return items.sort((a, b) => {
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
    return items.sort((a, b) => {
      if (!a.practiced_at && !b.practiced_at) return 0
      if (!a.practiced_at) return 1
      if (!b.practiced_at) return -1
      return b.practiced_at.localeCompare(a.practiced_at)
    })
  }, [searchedMap.buckets, searchQuery, userLoc])

  const totalCount = searchedMap.total_count

  const showCategoryFilter =
    !error &&
    !(isLoading && !showingDemo) &&
    (categoryCatalog.length > 0 || categoryIds.size > 0 || hasUncategorized || showingDemo)

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-16" />
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">食鉴图</h1>
        <div className="flex w-16 justify-end">
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

      <section className="flex-1 px-4">
        <div className="mb-3 flex items-center gap-2">
          <CityPicker variant="navbar" />
          <div className="relative flex min-w-0 flex-1 items-center">
            <SearchIcon
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-4 shrink-0 text-neutral-400"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索我吃过的店"
              className="w-full rounded-full bg-neutral-100 py-2.5 pl-9 pr-8 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-colors focus:bg-neutral-200/60 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}
                className="absolute right-3 flex items-center justify-center text-neutral-400 active:text-neutral-600"
                aria-label="清除搜索"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {showCategoryFilter ? (
            <TierMapCategoryFilter
              buckets={map.buckets}
              catalog={categoryCatalog}
              selected={displayCategoryFilter}
              onSelect={setCategoryFilter}
            />
          ) : null}
        </div>

        {isLoading && !showingDemo ? (
          <p className="py-12 text-center text-sm text-neutral-400">载入中…</p>
        ) : error && !showingDemo ? (
          <p className="py-12 text-center text-sm text-rose-400">
            读取失败：{(error as Error).message}
          </p>
        ) : viewMode === 'grid' ? (
          <TierMap buckets={searchedMap.buckets} />
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

const TIER_TEXT_COLOR: Record<Tier, string> = {
  boom: '#fff',
  hang: '#fff',
  top: '#fff',
  upper: '#5a4a00',
  npc: '#6b5a3a',
  bad: '#999',
}
function tierTextColor(tier: Tier): string { return TIER_TEXT_COLOR[tier] }

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
