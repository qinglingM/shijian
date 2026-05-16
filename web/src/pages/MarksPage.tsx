import { Link } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useMyMarksFeed } from '@/features/marks/useMyMarksFeed'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const markedFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

export function MarksPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const marksQ = useMyMarksFeed(userId)

  if (!isSupabaseConfigured) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">
          配置 Supabase 后即可同步「想去」标记。
        </p>
      </>
    )
  }

  if (!userId) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">
          登录后可查看你标记为想去的门店。{' '}
          <Link to="/auth?redirect=/me/marks" className="font-medium text-orange-700 underline underline-offset-2">
            去登录
          </Link>
        </p>
      </>
    )
  }

  if (marksQ.isPending) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-10 text-center text-sm text-neutral-400">载入标记…</p>
      </>
    )
  }

  if (marksQ.isError) {
    return (
      <>
        <BackHeader title="我的标记" backTo="/me" />
        <p className="px-5 py-8 text-sm text-rose-600">
          读取失败：{(marksQ.error as Error)?.message ?? '未知错误'}
        </p>
      </>
    )
  }

  const { want, reviewed } = marksQ.data ?? { want: [], reviewed: [] }
  const empty = want.length === 0 && reviewed.length === 0

  return (
    <>
      <BackHeader title="我的标记" backTo="/me" />
      <div className="px-4 py-4">
        <p className="text-[12px] leading-relaxed text-neutral-500">
          「仍想去」为有标记且尚未有效食鉴的店；「已评价」按你最近一次有效食鉴时间排列（与是否仍标记无关）。
        </p>

        {empty ? (
          <p className="mt-8 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
            还没有标记或有效食鉴过的店。在门店页标记「想去」，或完成食鉴后会出现在对应分组。
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            <section>
              <h2 className="text-[12px] font-semibold tracking-tight text-neutral-600">仍想去</h2>
              {want.length === 0 ? (
                <p className="mt-2 text-[12px] text-neutral-400">当前没有待食鉴的标记。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {want.map((m) => (
                    <li key={m.mark_id}>
                      <Link
                        to={`/restaurants/${m.restaurant_id}`}
                        className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-2.5 active:bg-neutral-50"
                      >
                        {m.cover_image_url ? (
                          <img
                            src={m.cover_image_url}
                            alt=""
                            className="size-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-500">
                            {m.display_name.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-neutral-900">
                            {m.display_name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-400">
                            标记于 {markedFmt.format(new Date(m.marked_at))}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-orange-600">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-[12px] font-semibold tracking-tight text-neutral-600">已评价</h2>
              {reviewed.length === 0 ? (
                <p className="mt-2 text-[12px] text-neutral-400">你还没有有效食鉴记录。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {reviewed.map((m) => (
                    <li key={m.restaurant_id}>
                      <Link
                        to={`/restaurants/${m.restaurant_id}`}
                        className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-2.5 active:bg-neutral-50"
                      >
                        {m.cover_image_url ? (
                          <img
                            src={m.cover_image_url}
                            alt=""
                            className="size-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-500">
                            {m.display_name.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-neutral-900">
                            {m.display_name}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-emerald-700">
                            最近一次有效食鉴 · {markedFmt.format(new Date(m.last_practice_at))}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-orange-600">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  )
}
