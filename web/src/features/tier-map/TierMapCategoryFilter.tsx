import { useMemo } from 'react'
import {
  TIER_MAP_UNCATEGORIZED_FILTER,
  summarizeTierMapCategoryKeys,
  type TierBucket,
} from '@/features/tier-map/useTierMap'

interface TierMapCategoryFilterProps {
  buckets: TierBucket[]
  /** 后台分类表全集（可与食鉴数据中未出现的类目一并展示） */
  catalog?: { id: string; name: string }[]
  selected: string | null
  onSelect: (categoryId: string | null) => void
}

export function TierMapCategoryFilter({
  buckets,
  catalog = [],
  selected,
  onSelect,
}: TierMapCategoryFilterProps) {
  const { categoryIds, hasUncategorized } = useMemo(
    () => summarizeTierMapCategoryKeys(buckets),
    [buckets],
  )

  const options = useMemo(() => {
    const labelById = new Map<string, string>()
    for (const c of catalog) {
      if (c.id) labelById.set(c.id, c.name.trim() || '分类')
    }
    for (const b of buckets) {
      for (const r of b.restaurants) {
        const id = r.category_id
        if (id && !labelById.has(id)) labelById.set(id, r.category_name?.trim() || '分类')
      }
    }
    const mergedIds = new Set<string>([...catalog.map((c) => c.id), ...categoryIds])
    const cats = [...mergedIds]
      .filter(Boolean)
      .map((id) => ({ id, name: labelById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return cats
  }, [buckets, catalog, categoryIds])

  return (
    <div className="relative max-w-[7.5rem] min-w-[5.5rem]">
      <select
        aria-label="按美食分类筛选食鉴图"
        className="w-full appearance-none truncate rounded-xl border border-neutral-200 bg-white py-1 pr-6 pl-2 text-[10px] font-semibold text-neutral-800 outline-none shadow-sm"
        value={selected ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onSelect(null)
          else onSelect(v)
        }}
      >
        <option value="">全部分类</option>
        {hasUncategorized ? (
          <option value={TIER_MAP_UNCATEGORIZED_FILTER}>未分类</option>
        ) : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
        ▾
      </span>
    </div>
  )
}
