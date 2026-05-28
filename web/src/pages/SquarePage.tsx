import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, PenSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_ORDER, TIER_LABEL, TIER_COLOR_VAR, TIER_SOFT_VAR, type Tier, type VoteType } from '@/lib/db'
import { useSquareFeed, type SquareFeedItem } from '@/features/square/useSquareFeed'
import { useTodayPracticeCount } from '@/features/square/useTodayPracticeCount'
import { applyStoreReviewVoteClick, intentAfterVoteTap } from '@/features/restaurants/storeReviewVotes'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCities } from '@/features/city-picker/useCities'

type SortMode = 'latest' | 'hot'

const TIER_TEXT_COLOR: Record<Tier, string> = {
  boom: '#fff',
  hang: '#fff',
  top: '#fff',
  upper: '#5a4a00',
  npc: '#6b5a3a',
  bad: '#999',
}

function removeBracketContent(name: string): string {
  return name.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
}

const AMAP_MID_CATEGORIES: { name: string; subs: string[] }[] = [
  {
    name: '中餐厅',
    subs: ['综合酒楼','四川菜','广东菜','山东菜','江苏菜','浙江菜','上海菜','湖南菜','安徽菜','福建菜','北京菜','湖北菜','东北菜','云贵菜','西北菜','老字号','海鲜酒楼','中式素菜馆','清真菜馆','台湾菜','潮州菜','火锅店','特色/地方风味餐厅']
      .map(s => removeBracketContent(s)),
  },
  {
    name: '外国餐厅',
    subs: ['西餐厅','日本料理','韩国料理','法式菜品餐厅','意式菜品餐厅','泰国/越南菜品餐厅','地中海风格菜品','美式风味','印度风味','英国式菜品餐厅','牛扒店(扒房)','俄国菜','葡国菜','德国菜','巴西菜','墨西哥菜','其它亚洲菜']
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

export function SquarePage() {
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useSquareFeed()
  const feed = useMemo(() => infiniteData?.pages.flat() ?? [], [infiniteData])
  const { data: todayCount = 0 } = useTodayPracticeCount()
  const { data: allCities = [] } = useCities()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Sort state
  const [sortMode, setSortMode] = useState<SortMode>('latest')

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'city' | 'tier' | 'category'>('city')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null)

  const [appliedCity, setAppliedCity] = useState<string | null>(null)
  const [appliedTier, setAppliedTier] = useState<Tier | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null)

  const [pendingCity, setPendingCity] = useState<string | null>(null)
  const [pendingTier, setPendingTier] = useState<Tier | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  // Pull-to-refresh
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'refreshing'>('idle')
  const [pullDist, setPullDist] = useState(0)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  function getScrollTop(): number {
    const el = scrollRef.current?.parentElement
    if (!el) return 0
    return el.scrollTop
  }

  function handlePullStart(e: React.TouchEvent) {
    if (isLoading || pullState === 'refreshing') return
    if (getScrollTop() > 0) return
    touchStartY.current = e.touches[0].clientY
    setPullState('pulling')
  }

  function handlePullMove(e: React.TouchEvent) {
    if (pullState !== 'pulling') return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy <= 0) { setPullDist(0); setPullState('idle'); return }
    setPullDist(Math.min(dy * 0.4, 80))
  }

  async function handlePullEnd() {
    if (pullState !== 'pulling') return
    if (pullDist > 40) {
      setPullState('refreshing')
      try { await refetch() } catch { /* ignore */ }
    }
    setPullDist(0)
    setPullState('idle')
  }

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

  // Categories data (static Amap mid categories)
  const categoryGroups = useMemo(() => AMAP_MID_CATEGORIES, [])

  // Infinite scroll — 滚动到底时加载下一页
  useEffect(() => {
    if (!hasNextPage) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage])

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
      items = items.filter(r => 
        r.amap_mid_category === appliedCategory || 
        removeBracketContent(r.amap_small_category || '') === appliedCategory
      )
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
  const otherSortMode: SortMode = sortMode === 'latest' ? 'hot' : 'latest'

  function handleReset() {
    setSelectedProvince(null)
    setSelectedBigCategory(null)
    if (filterTab === 'city') { setPendingCity(null); setAppliedCity(null) }
    if (filterTab === 'tier') { setPendingTier(null); setAppliedTier(null) }
    if (filterTab === 'category') { setPendingCategory(null); setAppliedCategory(null) }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white pt-[env(safe-area-inset-top)]">
      {/* Toolbar wrapper (for absolute filter panel) */}
      <div className="relative">
        {/* Search + Sort bar */}
        <section className="px-4 pt-2 pb-3">
          <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Search size={15} className="shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索餐厅、评价、分类…"
              className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none"
              enterKeyHint="search"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortMode(otherSortMode)}
            className="shrink-0 text-sm font-medium text-neutral-500 active:text-neutral-700"
          >
            {sortLabel}
          </button>
        </div>
      </section>

      {/* Filter bar */}
      <div className="flex px-4 z-[998] relative">
        <button
          onClick={() => { setPendingCity(appliedCity); const t = 'city'; setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
            (filterTab === 'city' && filterOpen) || appliedCity ? 'text-blue-600' : 'text-neutral-600'
          }`}
        >
          {appliedCity || '城市'}
          {(filterTab === 'city' && filterOpen) || appliedCity ? (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
          ) : null}
        </button>
        <div className="w-px bg-neutral-200 shrink-0" />
        <button
          onClick={() => { setPendingTier(appliedTier); const t = 'tier'; setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
            (filterTab === 'tier' && filterOpen) || appliedTier ? 'text-blue-600' : 'text-neutral-600'
          }`}
        >
          {appliedTier ? TIER_LABEL[appliedTier] : '等级'}
          {(filterTab === 'tier' && filterOpen) || appliedTier ? (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
          ) : null}
        </button>
        <div className="w-px bg-neutral-200 shrink-0" />
        <button
          onClick={() => { setPendingCategory(appliedCategory); const t = 'category'; setFilterTab(t); setFilterOpen(true) }}
          className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
            (filterTab === 'category' && filterOpen) || appliedCategory ? 'text-blue-600' : 'text-neutral-600'
          }`}
        >
          {appliedCategory || '分类'}
          {(filterTab === 'category' && filterOpen) || appliedCategory ? (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
          ) : null}
        </button>
      </div>

      {/* 今日新增 */}
      <p className="px-4 pb-2 pt-2 text-center text-xs text-neutral-500">
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
                        className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors ${selectedProvince === pname ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}
                      >
                        {pname}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const cities = selectedProvince ? provinces.find(([p]) => p === selectedProvince)?.[1] ?? [] : []
                      return cities.length > 0 ? cities.map((name) => (
                        <button key={name} onClick={() => setPendingCity(pendingCity === name ? null : name)}
                          className={`w-full px-4 py-1.5 text-left text-[13px] transition-colors ${pendingCity === name ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
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
                    <button key={tier} onClick={() => setPendingTier(pendingTier === tier ? null : tier)}
                      className={`rounded-lg py-3 text-[13px] font-bold leading-none transition-all ${pendingTier === tier ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : 'shadow-sm ring-1 ring-black/[0.06]'}`}
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
                      <button key={g.name} onClick={() => {
                        if (selectedBigCategory === g.name) {
                          setSelectedBigCategory(null); setPendingCategory(null)
                        } else {
                          setSelectedBigCategory(g.name); setPendingCategory(g.name)
                        }
                      }}
                        className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors ${selectedBigCategory === g.name ? 'bg-white font-semibold text-blue-600' : 'text-neutral-700 hover:bg-white/80'}`}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const active = categoryGroups.find(g => g.name === selectedBigCategory)
                      return active ? active.subs.map((sub) => (
                        <button key={sub} onClick={() => setPendingCategory(pendingCategory === sub ? null : sub)}
                          className={`w-full px-4 py-1.5 text-left text-[13px] transition-colors ${pendingCategory === sub ? 'font-semibold text-blue-600' : 'text-neutral-700'}`}>
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
              <button
                onClick={() => {
                  setAppliedCity(pendingCity)
                  setAppliedTier(pendingTier)
                  setAppliedCategory(pendingCategory)
                  setFilterOpen(false)
                }}
                disabled={filterTab === 'city' && !!selectedProvince && !pendingCity}
                className={`flex-1 rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm ${
                  filterTab === 'city' && selectedProvince && !pendingCity
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-500 active:bg-blue-600'
                }`}
              >
                确定
              </button>
            </div>
          </div>
        </>
      )}

      </div>

      {/* Content */}
      <section
        ref={scrollRef}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        className="flex-1 px-4 pt-3 pb-6 bg-neutral-50/60"
      >
        {pullDist > 0 && (
          <div className="flex justify-center pb-2" style={{ height: pullDist, overflow: 'hidden', transition: 'height 0.15s' }}>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <svg className={`size-4 ${pullState === 'refreshing' ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              {pullState === 'refreshing' ? '刷新中…' : pullDist > 40 ? '松手刷新' : '下拉刷新'}
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="py-14 text-center text-sm text-neutral-400">载入广场内容…</p>
        ) : !isLoading && filteredFeed.length === 0 ? (
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
        {hasNextPage && <div ref={sentinelRef} className="h-4" />}
        {isFetchingNextPage && (
          <p className="py-4 text-center text-sm text-neutral-400">载入更多…</p>
        )}
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
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData<InfiniteData<SquareFeedItem[]>>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((x) => {
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
          ),
        }
      })
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
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 shrink items-center gap-1.5">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              {item.avatar_url ? (
                <img src={item.avatar_url} alt={item.nickname} className="size-full rounded-full object-cover" />
              ) : (
                <PenSquare size={10} />
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
              'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50',
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
