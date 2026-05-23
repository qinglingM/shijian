import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, PenSquare, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_ORDER, TIER_LABEL, TIER_COLOR_VAR, TIER_SOFT_VAR, type Tier, type VoteType } from '@/lib/db'
import { useSquareFeed, type SquareFeedItem } from '@/features/square/useSquareFeed'
import { useTodayPracticeCount } from '@/features/square/useTodayPracticeCount'
import { applyStoreReviewVoteClick, intentAfterVoteTap } from '@/features/restaurants/storeReviewVotes'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCities } from '@/features/city-picker/useCities'
import { SHIJIAN_CATEGORIES, SUBCATEGORY_TO_CATEGORY, type ShijianCategoryCode } from '@/lib/poi/shijian-categories'

type SortMode = 'latest' | 'hot'

const TIER_TEXT_COLOR: Record<Tier, string> = {
  boom: '#fff',
  hang: '#fff',
  top: '#fff',
  upper: '#5a4a00',
  npc: '#6b5a3a',
  bad: '#999',
}

const MID_TO_BIG: Record<string, ShijianCategoryCode> = {
  '中餐厅': 'chinese',
  '外国餐厅': 'western',
  '快餐厅': 'snack_fast',
  '休闲餐饮场所': 'other',
  '咖啡厅': 'coffee_tea',
  '茶艺馆': 'coffee_tea',
  '冷饮店': 'coffee_tea',
  '糕饼店': 'dessert_bakery',
  '甜品店': 'dessert_bakery',
  '餐饮相关场所': 'other',
}

export function SquarePage() {
  const { data: feed = [], isLoading } = useSquareFeed()
  const { data: todayCount = 0 } = useTodayPracticeCount()
  const { data: allCities = [] } = useCities()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sort state
  const [sortMode, setSortMode] = useState<SortMode>('latest')
  const [sortOpen, setSortOpen] = useState(false)

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'city' | 'tier' | 'category'>('city')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null)

  const [appliedCity, setAppliedCity] = useState<string | null>(null)
  const [appliedTier, setAppliedTier] = useState<Tier | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null)

  // Cities data for province → city drill-down
  const provinces = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of allCities) {
      const p = c.province_name?.trim() || '其他'
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(c.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
  }, [allCities])

  // Categories data
  const categoryGroups = useMemo(
    () => SHIJIAN_CATEGORIES.map((cat) => ({
      code: cat.code,
      name: cat.name,
      subs: cat.subcategories.map((s) => s.name),
    })),
    [],
  )

  // Filter + search + sort logic
  const filteredFeed = useMemo(() => {
    let items = feed

    // Search
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      items = items.filter(item =>
        item.restaurant_name.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.category_label && item.category_label.toLowerCase().includes(q))
      )
    }

    // City
    if (appliedCity) items = items.filter(item => item.city_name === appliedCity)
    // Tier
    if (appliedTier) items = items.filter(item => item.tier === appliedTier)
    // Category
    if (appliedCategory) {
      const cat = SHIJIAN_CATEGORIES.find(c => c.name === appliedCategory)
      if (cat) {
        items = items.filter(r => {
          if (!r.category_label) return false
          const subCode = SUBCATEGORY_TO_CATEGORY[r.category_label]
          if (subCode === cat.code) return true
          const midCode = MID_TO_BIG[r.category_label]
          if (midCode === cat.code) return true
          return false
        })
      } else {
        items = items.filter(r => r.category_label === appliedCategory)
      }
    }

    // Sort
    if (sortMode === 'hot') {
      items = [...items].sort((a, b) => b.youpin_count - a.youpin_count)
    }

    return items
  }, [feed, searchQuery, appliedCity, appliedTier, appliedCategory, sortMode])

  const columns = useMemo(() => splitIntoMasonryColumns(filteredFeed), [filteredFeed])

  // Sort dropdown
  const sortLabel = sortMode === 'latest' ? '最新' : '最热'
  const otherSortLabel = sortMode === 'latest' ? '最热' : '最新'
  const otherSortMode: SortMode = sortMode === 'latest' ? 'hot' : 'latest'

  function handleReset() {
    setAppliedCity(null)
    setAppliedTier(null)
    setAppliedCategory(null)
    setSelectedProvince(null)
    setSelectedBigCategory(null)
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      {/* Toolbar wrapper (for absolute filter panel) */}
      <div className="relative">
        {/* Search + Sort bar */}
        <section className="px-4 pt-4">
          <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索餐厅、评价、分类…"
              className="w-full rounded-full bg-neutral-100 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-neutral-400"
              enterKeyHint="search"
            />
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-2.5 text-sm font-medium text-neutral-700"
            >
              {sortLabel}
              <ChevronDown size={14} className={cn('transition-transform', sortOpen && 'rotate-180')} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[5rem] rounded-lg bg-white shadow-lg ring-1 ring-black/[0.06] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setSortMode(otherSortMode); setSortOpen(false) }}
                    className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {otherSortLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <button
          onClick={() => { const t = 'city'; if (filterOpen && filterTab === t) { setFilterOpen(false); return } setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
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
          onClick={() => { const t = 'tier'; if (filterOpen && filterTab === t) { setFilterOpen(false); return } setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
            filterTab === 'tier' && filterOpen
              ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
              : appliedTier
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {appliedTier ? TIER_LABEL[appliedTier] : '等级'}
        </button>
        <button
          onClick={() => { const t = 'category'; if (filterOpen && filterTab === t) { setFilterOpen(false); return } setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
            filterTab === 'category' && filterOpen
              ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
              : appliedCategory
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {appliedCategory || '分类'}
        </button>
      </div>

      {/* 今日新增 */}
      <p className="px-4 pb-2 text-center text-xs text-neutral-500">
        今日新增 <span className="font-semibold text-orange-600 tabular-nums">{todayCount}</span> 条餐厅评价
      </p>

      {/* Filter panel (absolute positioned) */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 z-[997]" onClick={() => setFilterOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-[999] mx-auto max-w-md bg-white shadow-xl rounded-b-2xl overflow-hidden" style={{ animation: 'shijian-slide-down 0.2s ease-out' }}>
            <div className="overflow-y-auto" style={{ maxHeight: '45dvh' }}>
              {filterTab === 'city' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {provinces.map(([pname]) => (
                      <button
                        key={pname}
                        onClick={() => setSelectedProvince(selectedProvince === pname ? null : pname)}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${selectedProvince === pname ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}
                      >
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
              {filterTab === 'tier' && (
                <div className="grid grid-cols-3 gap-3 px-4 py-5">
                  {TIER_ORDER.map((tier) => (
                    <button key={tier} onClick={() => setAppliedTier(appliedTier === tier ? null : tier)}
                      className={`rounded-lg py-3 text-[13px] font-bold leading-none transition-all ${appliedTier === tier ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : 'shadow-sm ring-1 ring-black/[0.06]'}`}
                      style={{ background: TIER_COLOR_VAR[tier], color: TIER_TEXT_COLOR[tier] }}>
                      {TIER_LABEL[tier]}
                    </button>
                  ))}
                </div>
              )}
              {filterTab === 'category' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {categoryGroups.map((g) => (
                      <button key={g.code} onClick={() => {
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
                      return active ? active.subs.map((sub) => (
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
              {(appliedCity || appliedTier || appliedCategory) ? (
                <button onClick={handleReset} className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 text-[14px] font-semibold text-neutral-600 shadow-sm active:bg-neutral-50">重置</button>
              ) : null}
              <button onClick={() => setFilterOpen(false)} className="flex-1 rounded-xl bg-blue-500 py-3 text-[14px] font-semibold text-white shadow-sm active:bg-blue-600">确定</button>
            </div>
          </div>
        </>
      )}

      </div>

      {/* Content */}
      <section className="flex-1 px-4 pt-3 pb-6">
        {isLoading ? (
          <p className="py-14 text-center text-sm text-neutral-400">载入广场内容…</p>
        ) : filteredFeed.length === 0 ? (
          <p className="py-14 text-center text-sm text-neutral-400">暂无相关内容</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {columns.map((col, idx) => (
            <div key={idx} className="space-y-3">
              {col.map((item) => (
                <SquareCard key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function splitIntoMasonryColumns(items: SquareFeedItem[]) {
  const left: SquareFeedItem[] = []
  const right: SquareFeedItem[] = []
  let leftHeight = 0
  let rightHeight = 0
  for (const item of items) {
    const score = estimateCardHeight(item)
    if (leftHeight <= rightHeight) {
      left.push(item)
      leftHeight += score
    } else {
      right.push(item)
      rightHeight += score
    }
  }
  return [left, right]
}

function estimateCardHeight(item: SquareFeedItem) {
  const tierRank: Record<string, number> = {
    boom: 0,
    hang: 1,
    top: 2,
    upper: 3,
    npc: 4,
    bad: 5,
  }
  const rank = tierRank[item.tier] ?? 2
  return 2.1 - rank * 0.03
}

function SquareCard({ item }: { item: SquareFeedItem }) {
  const queryClient = useQueryClient()
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  const voteMut = useMutation({
    mutationFn: async (next: VoteType | null) => {
      if (!isSupabaseConfigured) throw new Error('暂无可用后端')
      if (!viewerId) throw new Error('请先登录')
      const sb = getSupabase()
      if (next === null) {
        const { error } = await sb
          .from('review_votes')
          .delete()
          .match({ user_id: viewerId, target_type: 'store_review', target_id: item.id })
        if (error) throw error
        return
      }
      const { error } = await sb.from('review_votes').upsert(
        {
          user_id: viewerId,
          target_type: 'store_review',
          target_id: item.id,
          vote_type: next,
        },
        { onConflict: 'user_id,target_type,target_id' },
      )
      if (error) throw error
    },
    onMutate: async (next) => {
      const key = ['square-feed', viewerId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SquareFeedItem[]>(key)
      queryClient.setQueryData<SquareFeedItem[]>(key, (old) =>
        old?.map((x) => {
          if (x.id !== item.id) return x
          const patched = applyStoreReviewVoteClick(
            x.youpin_count,
            x.yebang_count,
            x.my_vote,
            'youpin',
          )
          return {
            ...x,
            youpin_count: patched.youpin,
            yebang_count: patched.yebang,
            my_vote: next,
          }
        }),
      )
      return { previous }
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['square-feed', viewerId], ctx.previous)
      window.alert(err instanceof Error ? err.message : '操作失败，请稍后重试')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['square-feed', viewerId] })
    },
  })

  function toggleYoupin() {
    if (voteMut.isPending) return
    if (!viewerId) {
      window.alert('请先登录后再参与有品投票')
      return
    }
    voteMut.mutate(intentAfterVoteTap(item.my_vote, 'youpin'))
  }

  const liked = item.my_vote === 'youpin'

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-100">
      <Link to={`/restaurants/${item.restaurant_id}`} className="block">
        <div
          className="relative flex items-stretch justify-stretch p-3 text-white"
          style={{
            background: tierBg(item.tier),
            aspectRatio: tierAspect(item.tier),
          }}
        >
          <span className="absolute left-3 top-2.5 text-[11px] font-bold leading-none">{item.tier_label}</span>
          <div className="flex w-full flex-col justify-between">
            <div className="flex flex-1 items-center justify-center px-2 text-center">
              <p
                className={cn(
                  'line-clamp-2 font-black leading-tight text-black',
                  item.tier === 'boom' && 'text-[16px]',
                  item.tier === 'hang' && 'text-[15.5px]',
                  item.tier === 'top' && 'text-[15px]',
                  item.tier === 'upper' && 'text-[14.5px]',
                  item.tier === 'npc' && 'text-[14px]',
                  item.tier === 'bad' && 'text-[13.5px]',
                )}
              >
                {item.content}
              </p>
            </div>
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 pt-2">
        <p className="text-[13px] font-bold text-neutral-900">{item.restaurant_name}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              {item.avatar_url ? (
                <img src={item.avatar_url} alt={item.nickname} className="size-full rounded-full object-cover" />
              ) : (
                <PenSquare size={12} />
              )}
            </div>
            <p className="truncate text-[10px] font-semibold text-sky-700">{item.nickname}</p>
          </div>
          <button
            type="button"
            disabled={voteMut.isPending}
            aria-pressed={liked}
            onClick={toggleYoupin}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50',
              liked
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'bg-orange-50 text-orange-700 ring-1 ring-orange-100 active:bg-orange-100',
            )}
          >
            <span className={liked ? '' : 'text-orange-500'}>{item.youpin_count}</span>
            有品
          </button>
        </div>
      </div>
    </article>
  )
}

function tierBg(tier: Tier) {
  return TIER_SOFT_VAR[tier]
}

function tierAspect(tier: Tier) {
  const map: Record<Tier, string> = {
    boom: '4 / 4.04',
    hang: '4 / 3.97',
    top: '4 / 3.90',
    upper: '4 / 3.82',
    npc: '4 / 3.75',
    bad: '4 / 3.68',
  }
  return map[tier]
}
