import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, PenSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_SOFT_VAR, type Tier, type VoteType } from '@/lib/db'
import { useSquareFeed, type SquareFeedItem } from '@/features/square/useSquareFeed'
import { useTodayPracticeCount } from '@/features/square/useTodayPracticeCount'
import { applyStoreReviewVoteClick, intentAfterVoteTap } from '@/features/restaurants/storeReviewVotes'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

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
