import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, PenSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_SOFT_VAR, type Tier } from '@/lib/db'
import { useSquareFeed, type SquareFeedItem } from '@/features/square/useSquareFeed'
import { useTodayPracticeCount } from '@/features/square/useTodayPracticeCount'

export function SquarePage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const { data: feed = [], isLoading } = useSquareFeed()
  const { data: todayCount = 0 } = useTodayPracticeCount()
  const columns = useMemo(() => splitIntoMasonryColumns(feed), [feed])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = draft.trim()
    if (q) navigate('/search?q=' + encodeURIComponent(q))
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <section className="px-4 pt-4">
        <form onSubmit={onSearch} className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="搜索餐厅来看看别人的评价"
            className="w-full rounded-full bg-neutral-100 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-neutral-400"
            enterKeyHint="search"
          />
        </form>
        <p className="mt-1.5 text-center text-xs text-neutral-500">
          今日新增 <span className="font-semibold text-orange-600 tabular-nums">{todayCount}</span> 条餐厅评价
        </p>
      </section>

      <section className="flex-1 px-4 pt-5 pb-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">最新动态</h2>

        {isLoading ? (
          <p className="py-14 text-center text-sm text-neutral-400">载入广场内容…</p>
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
          <div className="flex w-full flex-col justify-between">
            <p className="truncate text-[11px] font-semibold opacity-90">{item.restaurant_name}</p>
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
            <p className="text-[11px] font-medium opacity-85">{item.tier_label}</p>
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 pt-2">
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              {item.avatar_url ? (
                <img src={item.avatar_url} alt={item.nickname} className="size-full rounded-full object-cover" />
              ) : (
                <PenSquare size={14} />
              )}
            </div>
            <p className="truncate text-xs font-semibold text-neutral-900">{item.nickname}</p>
          </div>
          <div className="shrink-0 text-[11px] text-neutral-500">有品 {item.youpin_count}</div>
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
    boom: '4 / 5.05',
    hang: '4 / 4.96',
    top: '4 / 4.87',
    upper: '4 / 4.78',
    npc: '4 / 4.69',
    bad: '4 / 4.60',
  }
  return map[tier]
}
