import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Map, Search as SearchIcon } from 'lucide-react'
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
} from '@/features/tier-map/useTierMap'
import { useCategories } from '@/features/categories/useCategories'

const EMOTION = '把吃过的店，摆成自己的战利品墙'

export function HomePage() {
  const manualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.manualShowDemo)
  const setManualShowDemo = useTierMapDemoStore((s: TierMapDemoStore) => s.setManualShowDemo)
  const { map, showingDemo, isLoading, error } = useDisplayedTierMap()
  const categoriesQ = useCategories()

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const { categoryIds, hasUncategorized } = useMemo(
    () => summarizeTierMapCategoryKeys(map.buckets),
    [map.buckets],
  )

  /** 后台分类全集 + 图上已有分类，下拉始终有可选「美食种类」 */
  const categoryCatalog = useMemo(
    () => (categoriesQ.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [categoriesQ.data],
  )

  /** 数据变化后剔除已不存在的筛选值，避免在无 effect 下写回 state（见 react-hooks/set-state-in-effect） */
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

  const showCategoryFilter =
    !error &&
    !(isLoading && !showingDemo) &&
    (categoryCatalog.length > 0 || categoryIds.size > 0 || hasUncategorized || showingDemo)

  const filterActive = displayCategoryFilter !== null

  let filterLabelBadge: string | null = null
  if (displayCategoryFilter === TIER_MAP_UNCATEGORIZED_FILTER) filterLabelBadge = '未分类'
  else if (displayCategoryFilter !== null)
    filterLabelBadge =
      map.buckets
        .flatMap((b) => b.restaurants)
        .find((r) => r.category_id === displayCategoryFilter)?.category_name ??
      categoryCatalog.find((c) => c.id === displayCategoryFilter)?.name ??
      '该类'

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      {/* 顶部：城市 + 搜索 + 菜单 */}
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <Link
          to="/map"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-black/[0.06] transition-colors active:bg-neutral-200"
          aria-label="实践地图"
        >
          <Map size={18} aria-hidden strokeWidth={2.2} />
        </Link>
        <Link
          to="/search"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-neutral-100 p-1.5 text-sm text-neutral-400 outline-none ring-orange-400/0 transition-[box-shadow,color] active:bg-neutral-200/90"
          aria-label="搜索我吃过的店"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5">
            <SearchIcon size={16} aria-hidden className="shrink-0 text-neutral-400" />
            <span className="truncate">搜索我吃过的店</span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700 shadow-sm ring-1 ring-black/[0.06]">
            搜索
          </span>
        </Link>
      </header>

      {/* 中部：情绪文案 + 总数 */}
      <section className="px-5 pt-4 pb-5">
        {filterActive ? (
          <>
            <p className="text-2xl font-semibold tracking-tight text-neutral-900">
              「{filterLabelBadge}」
              <span className="mx-1 text-lg font-semibold text-neutral-400">
                /
              </span>
              <span className="text-2xl">匹配</span>{' '}
              <span className="text-3xl">{displayMap.total_count}</span> 家店
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              全部分类合计{' '}
              <span className="font-semibold tabular-nums text-neutral-700">
                {map.total_count}
              </span>{' '}
              家
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight text-neutral-900">
              你已经食鉴了{' '}
              <span className="text-3xl text-neutral-900">{map.total_count}</span> 家店
            </p>
          </>
        )}
        <div className="mt-4 flex items-center gap-3">
          <CityPicker variant="field" />
        </div>
        <p className="mt-1.5 text-sm text-neutral-500">{EMOTION}</p>
      </section>

      {/* 六档食鉴图 */}
      <section className="flex-1 px-4">
        <div className="relative mb-3 rounded-2xl bg-neutral-50 px-4 py-3">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">
                今天这顿，值得被放进哪一格？
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                好吃是战绩，踩雷也是履历。你的食鉴图会越来越像一张城市胃口地图。
              </p>
            </div>
            {showCategoryFilter ? (
              <div className="shrink-0 self-start space-y-1 pt-0.5 text-right">
                <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">
                  筛选 · 种类
                </p>
                <TierMapCategoryFilter
                  buckets={map.buckets}
                  catalog={categoryCatalog}
                  selected={displayCategoryFilter}
                  onSelect={setCategoryFilter}
                />
              </div>
            ) : null}
          </div>
        </div>

        {isLoading && !showingDemo ? (
          <p className="py-12 text-center text-sm text-neutral-400">载入中…</p>
        ) : error && !showingDemo ? (
          <p className="py-12 text-center text-sm text-rose-400">
            读取失败：{(error as Error).message}
          </p>
        ) : (
          <TierMap
            buckets={displayMap.buckets}
            showAddSlots={!filterActive}
          />
        )}
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
