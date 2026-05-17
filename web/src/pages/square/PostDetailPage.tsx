import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, PenSquare, UserRound } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { useSquareFeed } from '@/features/square/useSquareFeed'
import { usePostVoteMutation } from '@/features/restaurants/usePostVotesMutation'

export function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: feed = [] } = useSquareFeed()
  const item = useMemo(() => feed.find((x) => x.kind === 'post' && x.id === `post:${id}`), [feed, id])
  const voteMut = usePostVoteMutation(item?.kind === 'post' ? item.id.split(':')[1] : null)

  if (!item || item.kind !== 'post') {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
        <BackHeader title="帖子详情" backTo="/square" />
        <div className="px-4 py-10 text-center text-sm text-neutral-500">帖子不存在或已被删除。</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <BackHeader title="帖子详情" backTo="/square" />
      <main className="flex-1 px-4 py-4">
        <article className="overflow-hidden rounded-3xl border border-neutral-100 bg-white">
          <div className="aspect-[3/4] bg-neutral-100">
            {item.cover_image_url ? (
              <img src={item.cover_image_url} alt={item.title} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-neutral-100 text-neutral-400">
                <ImageIcon size={30} />
              </div>
            )}
          </div>
          <div className="p-4">
            <h1 className="text-base font-semibold text-neutral-950">{item.title}</h1>
            <div className="mt-3 flex items-start gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                {item.avatar_url ? (
                  <img src={item.avatar_url} alt={item.nickname} className="size-full rounded-full object-cover" />
                ) : (
                  <PenSquare size={14} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{item.nickname}</p>
                <p className="text-[11px] text-neutral-400">{new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(item.created_at))}</p>
              </div>
              <div className="text-[11px] text-neutral-500">有品 {item.youpin_count}</div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-neutral-700">{item.content}</p>
          </div>
        </article>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl bg-orange-50 py-3 text-sm font-semibold text-orange-800"
            onClick={() => voteMut.mutate('youpin')}
            disabled={voteMut.isPending}
          >
            有品 {item.youpin_count}
          </button>
          <button
            type="button"
            className="rounded-2xl bg-neutral-100 py-3 text-sm font-semibold text-neutral-700"
            onClick={() => voteMut.mutate('yebang')}
            disabled={voteMut.isPending}
          >
            野榜 {item.yebang_count}
          </button>
        </div>
      </main>
    </div>
  )
}
