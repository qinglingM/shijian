import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useMyMarksFeed, type MyMarksWantRow } from '@/features/marks/useMyMarksFeed'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Bookmark, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

const markedFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

type Tab = 'want' | 'conquered'

export function MarksPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const marksQ = useMyMarksFeed(userId)
  const [tab, setTab] = useState<Tab>('want')

  if (!isSupabaseConfigured) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Bookmark className="mb-4 size-12 text-neutral-200" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-neutral-700">尚未配置云端</h3>
          <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
            配置 Supabase 后即可开启并同步「想去」标记功能。
          </p>
        </div>
      </>
    )
  }

  if (!userId) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Bookmark className="mb-4 size-12 text-neutral-200" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-neutral-700">登录以查看标记</h3>
          <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
            登录后可查看你标记为想去的门店。
          </p>
          <Link
            to="/auth?redirect=/me/marks"
            className="mt-6 rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-neutral-800"
          >
            去登录
          </Link>
        </div>
      </>
    )
  }

  if (marksQ.isPending) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-14 text-center text-sm font-medium text-neutral-400">载入标记…</p>
      </>
    )
  }

  if (marksQ.isError) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-8 text-sm font-medium text-rose-600">
          读取失败：{(marksQ.error as Error)?.message ?? '未知错误'}
        </p>
      </>
    )
  }

  const { want = [], conquered = [] } = marksQ.data ?? {}
  const list = tab === 'want' ? want : conquered

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <BackHeader title="我的标记" backTo="/me" />

      {/* 标签页切换栏 */}
      <div className="sticky top-[calc(3.5625rem+env(safe-area-inset-top))] z-10 flex border-b border-neutral-200 bg-white">
        {(
          [
            { key: 'want', label: '未鉴定标记', count: want.length },
            { key: 'conquered', label: '已鉴定标记', count: conquered.length },
          ] as { key: Tab; label: string; count: number }[]
        ).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors',
              tab === key ? 'text-neutral-900' : 'text-neutral-400',
            )}
          >
            {label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                tab === key
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-neutral-100 text-neutral-400',
              )}
            >
              {count}
            </span>
            {tab === key && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-orange-500" />
            )}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/50">
            <Bookmark className="size-8 text-neutral-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-bold text-neutral-800">空空如也</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
            {tab === 'want'
              ? '还没有未鉴定的标记。\n在门店页点击书签图标即可加入想去清单。'
              : '还没有已鉴定的标记。\n完成一次食鉴后，对应标记会自动移到这里。'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4">
          {list.map((m) => (
            <MarkCard key={m.mark_id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function MarkCard({ m }: { m: MyMarksWantRow }) {
  const location = [m.city_name, m.district_name].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/restaurants/${m.restaurant_id}`}
      className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.02] ring-1 ring-neutral-200/50 transition-all active:scale-[0.98] active:shadow-md"
    >
      {/* 封面图 */}
      <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
        {m.cover_image_url ? (
          <img src={m.cover_image_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-sm font-bold text-neutral-400">
            {m.display_name.slice(0, 2)}
          </div>
        )}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5" />
      </div>

      {/* 文字区 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        {/* 标记时间 */}
        <p className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
          <Bookmark size={11} strokeWidth={2.5} className="shrink-0 text-orange-400" />
          {markedFmt.format(new Date(m.marked_at))} 标记
        </p>

        {/* 分类 + 位置 */}
        {(m.category_label || location) && (
          <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            {m.category_label && (
              <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                {m.category_label}
              </span>
            )}
            {location && (
              <span className="flex min-w-0 items-center gap-0.5 truncate">
                <MapPin size={10} strokeWidth={2} className="shrink-0 text-neutral-300" />
                {location}
              </span>
            )}
          </p>
        )}

        {/* 店名 */}
        <h3 className="truncate text-[15px] font-bold leading-snug text-neutral-900">
          {m.display_name}
        </h3>
      </div>
    </Link>
  )
}
