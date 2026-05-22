import { Link } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { useMyMarksFeed } from '@/features/marks/useMyMarksFeed'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Bookmark, ArrowRight } from 'lucide-react'

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

  const { want } = marksQ.data ?? { want: [] }
  const empty = want.length === 0

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <BackHeader title="我的标记" backTo="/me" />
      
      {empty ? (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/50">
            <Bookmark className="size-8 text-neutral-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-bold text-neutral-800">空空如也</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
            还没有标记任何店。<br/>在门店页点击分享旁边的书签图标，即可加入「想去」清单。
          </p>
        </div>
      ) : (
        <div className="px-4 py-6 space-y-10">
          
          <section>
            <div className="mb-4 flex items-end justify-between px-1">
              <h2 className="text-[18px] font-black tracking-tight text-neutral-900">仍想去</h2>
              <span className="text-[12px] font-semibold text-orange-600">{want.length} 家</span>
            </div>

            {want.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200/80 bg-white/50 px-4 py-8 text-center">
                <p className="text-[13px] text-neutral-400 font-medium">当前没有待食鉴的标记，去发现一些新店吧！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {want.map((m) => (
                  <Link
                    key={m.mark_id}
                    to={`/restaurants/${m.restaurant_id}`}
                    className="group relative flex gap-4 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.02] ring-1 ring-neutral-200/50 transition-all active:scale-[0.98] active:shadow-md"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                      {m.cover_image_url ? (
                        <img src={m.cover_image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-sm font-bold text-neutral-400">
                          {m.display_name.slice(0, 2)}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5" />
                    </div>
                    
                    <div className="flex min-w-0 flex-1 flex-col py-0.5">
                      <h3 className="truncate text-[16px] font-bold leading-snug text-neutral-900">
                        {m.display_name}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
                        <Bookmark size={12} strokeWidth={2.5} className="text-orange-400" />
                        标记于 {markedFmt.format(new Date(m.marked_at))}
                      </p>
                      
                      <div className="mt-auto flex justify-end">
                        <span className="flex items-center gap-1 text-[12px] font-bold text-orange-600">
                          去看看 <ArrowRight size={14} strokeWidth={2.5} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
