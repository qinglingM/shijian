import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, MapPin, Search as SearchIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { BackHeader } from '@/components/layout/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function SearchRestaurantsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const qParam = params.get('q') ?? ''
  const [draft, setDraft] = useState(qParam)

  const viewerId = useAuthStore((s) => s.user?.id ?? null)

  const needle = normalize(qParam)

  const { data: results = [], isLoading, isFetching } = useQuery({
    queryKey: ['my-practice-search', needle, viewerId],
    enabled: isSupabaseConfigured && !!viewerId && needle.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const sb = getSupabase()

      const { data: myPractices } = await sb
        .from('practice_records')
        .select('restaurant_id')
        .eq('user_id', viewerId!)
        .eq('is_active', true)

      const ids = myPractices?.map((p) => p.restaurant_id) ?? []
      if (ids.length === 0) return []

      const { data: restaurants } = await sb
        .from('restaurants')
        .select('id, display_name, cover_image_url, address_text, city_name')
        .in('id', ids)
        .ilike('display_name', `%${needle}%`)
        .limit(20)

      return (restaurants ?? []).map((r) => ({
        poi_source: 'manual' as const,
        poi_id: r.id,
        poi_name: r.display_name,
        address_text: r.address_text ?? '',
        latitude: null as number | null,
        longitude: null as number | null,
        province_name: null as string | null,
        city_name: r.city_name ?? null,
        district_name: null as string | null,
        category: null as string | null,
        cover_image_url: r.cover_image_url ?? null,
        display_label: null as string | null,
      }))
    },
  })

  useEffect(() => {
    setDraft(qParam)
  }, [qParam])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = draft.trim()
    setParams(next ? { q: next } : {}, { replace: true })
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-white pb-4">
      <BackHeader title="搜索门店" backTo="/tier-map" />

      <div className="border-b border-neutral-100 px-4 pb-3 pt-2">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜你评价过的餐厅"
              className="w-full rounded-full bg-neutral-100 py-2.5 pr-10 pl-10 text-sm outline-none placeholder:text-neutral-400"
              autoComplete="off"
              enterKeyHint="search"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            搜索
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-500">
          {viewerId ? '仅支持搜索你评价过的餐厅' : '请先登录后再搜索你评价过的餐厅'}
        </p>
      </div>

      {!viewerId ? (
        <p className="px-4 pt-8 text-center text-sm text-neutral-500">
          请先登录，即可搜索你评价过的餐厅
        </p>
      ) : null}

      {isLoading || isFetching ? (
        <p className="py-14 text-center text-sm text-neutral-400">搜索中…</p>
      ) : null}

      {needle && viewerId && !isLoading && !isFetching && (
        <section className="px-4 pt-4">
          <p className="text-[12px] font-medium text-neutral-600">
            与「{qParam.trim()}」相关 ·{' '}
            <span className="tabular-nums text-orange-700">{results.length}</span> 条
          </p>
          {results.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              没有匹配的门店。换一个词试试。
              <button
                type="button"
                onClick={() => navigate('/tier-map')}
                className="mt-4 inline-block text-sm font-medium text-orange-600"
              >
                回食鉴图看看
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {results.map((poi) => {
                const region = [poi.city_name, poi.district_name].filter(Boolean).join(' ').trim() || '区域未知'
                const address = poi.address_text?.trim() || '地址未录入'
                return (
                  <li key={poi.poi_id}>
                    <Link
                      to={`/restaurants/${poi.poi_id}`}
                      className="block rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm active:bg-neutral-50"
                    >
                      <div className="flex gap-3">
                        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                          {poi.cover_image_url ? (
                            <img src={poi.cover_image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <MapPin className="size-6 text-orange-500" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">
                              {poi.poi_name}
                            </h3>
                            <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-300" aria-hidden />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              {region}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-neutral-500">
                            {address}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
