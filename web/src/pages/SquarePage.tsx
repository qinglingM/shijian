import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Search, Sparkles, Image as ImageIcon, PenSquare } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'
import { TIER_COLOR_VAR, TIER_SOFT_VAR, type Tier } from '@/lib/db'
import { useSquareFeed, type SquareFeedItem } from '@/features/square/useSquareFeed'

export function SquarePage() {
  const { data: feed = [], isLoading } = useSquareFeed()
  const columns = useMemo(() => splitIntoMasonryColumns(feed), [feed])

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <BackHeader title="广场" />

      <section className="px-4 pt-4">
        <div className="rounded-3xl border border-neutral-100 bg-neutral-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-orange-600 ring-1 ring-orange-100">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-neutral-950">双列广场</p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                公开食鉴会变成纯色封面卡片，图文帖子则直接展示首图。
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              to="/search"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Search size={16} />
              搜索内容
            </Link>
            <Link
              to="/practice/step1"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 ring-1 ring-neutral-200"
            >
              <Compass size={16} />
              去食鉴
            </Link>
          </div>
        </div>
      </section>

      <section className="flex-1 px-4 pt-5 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">最新动态</h2>
          <span className="text-xs text-neutral-400">双列瀑布流</span>
        </div>

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
  if (item.kind !== 'practice') return 2
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
      {item.kind === 'practice' ? (
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
      ) : (
        <Link to={`/square/post/${item.id.split(':')[1]}`} className="block">
          <div className="aspect-[4/5] bg-neutral-100">
            {item.cover_image_url ? (
              <img src={item.cover_image_url} alt={item.title} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-neutral-100 text-neutral-400">
                <ImageIcon size={28} />
              </div>
            )}
          </div>
        </Link>
      )}

      <div className="px-3 pb-3 pt-2">
        {item.kind === 'post' ? (
          <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-neutral-900">{item.title}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              {item.avatar_url ? (
                <img src={item.avatar_url} alt={item.nickname} className="size-full rounded-full object-cover" />
              ) : (
                <PenSquare size={14} />
              )}
            </div>
            <p className="truncate text-sm font-semibold text-neutral-900">{item.nickname}</p>
          </div>
          <div className="shrink-0 text-[11px] text-neutral-500">有品 {item.youpin_count}</div>
        </div>
      </div>
    </article>
  )
}

function PublishSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-200" />
        <p className="text-center text-sm font-semibold text-neutral-900">选择发布类型</p>
        <div className="mt-4 space-y-3">
          <Link to="/practice/step1" className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-5" onClick={onClose}>
            <span>
              <span className="block text-sm font-semibold text-neutral-900">发食鉴</span>
              <span className="block text-xs text-neutral-500">公开食鉴会自动变成广场封面卡片</span>
            </span>
            <ArrowUp size={16} className="text-neutral-400" />
          </Link>
          <Link to="/square/post/new" className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4" onClick={onClose}>
            <span>
              <span className="block text-sm font-semibold text-neutral-900">发帖子</span>
              <span className="block text-xs text-neutral-500">上传首图，填标题和内容</span>
            </span>
            <ArrowUp size={16} className="text-neutral-400" />
          </Link>
        </div>
      </div>
    </div>
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

function formatDate(dateLike: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(dateLike))
}
