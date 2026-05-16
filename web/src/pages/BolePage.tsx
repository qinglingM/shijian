import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { BackHeader } from '@/components/layout/AppLayout'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface BoleFeedRow {
  id: string
  awarded_at: string
  restaurant_id: string
  display_name: string
  cover_image_url: string | null
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
})

export function BolePage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const boleQ = useQuery<BoleFeedRow[]>({
    queryKey: ['my-bole-records', userId],
    enabled: isSupabaseConfigured && !!userId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('bole_records')
        .select(
          `
          id,
          awarded_at,
          restaurant_id,
          restaurants (
            display_name,
            cover_image_url
          )
        `,
        )
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('awarded_at', { ascending: false })

      if (error) throw error

      interface Row {
        id: string
        awarded_at: string
        restaurant_id: string
        restaurants:
          | { display_name: string | null; cover_image_url: string | null }
          | { display_name: string | null; cover_image_url: string | null }[]
          | null
      }

      const out: BoleFeedRow[] = []
      for (const row of ((data ?? []) as unknown as Row[])) {
        const rs = row.restaurants
        const r = rs && Array.isArray(rs) ? rs[0] : rs
        out.push({
          id: row.id,
          awarded_at: row.awarded_at,
          restaurant_id: row.restaurant_id,
          display_name: r?.display_name ?? '未知门店',
          cover_image_url: r?.cover_image_url ?? null,
        })
      }
      return out
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <>
        <BackHeader title="我的伯乐记录" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">配置 Supabase 后可查看伯乐记录。</p>
      </>
    )
  }

  if (!userId) {
    return (
      <>
        <BackHeader title="我的伯乐记录" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">
          登录后查看你获评「食鉴伯乐」的门店。{' '}
          <Link to="/auth?redirect=/me/bole" className="font-medium text-orange-700 underline underline-offset-2">
            去登录
          </Link>
        </p>
      </>
    )
  }

  if (boleQ.isPending) {
    return (
      <>
        <BackHeader title="我的伯乐记录" backTo="/me" />
        <p className="px-5 py-10 text-center text-sm text-neutral-400">载入中…</p>
      </>
    )
  }

  if (boleQ.isError) {
    return (
      <>
        <BackHeader title="我的伯乐记录" backTo="/me" />
        <p className="px-5 py-8 text-sm text-rose-600">
          读取失败：{(boleQ.error as Error)?.message ?? '未知错误'}
        </p>
      </>
    )
  }

  const rows = boleQ.data ?? []

  return (
    <>
      <BackHeader title="我的伯乐记录" backTo="/me" />
      <div className="px-4 py-4">
        <div className="flex items-start gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-violet-900">
          <Award className="mt-0.5 size-[14px] shrink-0 opacity-85" aria-hidden />
          <p>
            伯乐记录由系统依据「首家有效实践」规则自动生成；如对结果有疑问，可先核对门店的实践时间线后再反馈运营。
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
            暂无伯乐条目。完成对某店的首份有效公开实践后即有机会获评。
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/restaurants/${r.restaurant_id}`}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-2.5 active:bg-neutral-50"
                >
                  {r.cover_image_url ? (
                    <img src={r.cover_image_url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-500">
                      {r.display_name.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-neutral-900">{r.display_name}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-violet-700">
                      获评于 · {dateFmt.format(new Date(r.awarded_at))}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-orange-600">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
