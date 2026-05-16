import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search as SearchIcon } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { CityPicker } from '@/features/city-picker/CityPicker'
import type { Tier } from '@/lib/db'
import { TIER_LABEL, TIER_SOFT_VAR } from '@/lib/db'
import { useDisplayedTierMap } from '@/features/tier-map/useTierMap'
import { useCategories } from '@/features/categories/useCategories'

type Hit = {
  id: string
  display_name: string
  tier: Tier
  category_name: string | null
}

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function SearchRestaurantsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const qParam = params.get('q') ?? ''
  const [draft, setDraft] = useState(qParam)

  const { map, showingDemo, isLoading, error } = useDisplayedTierMap()
  const categoriesQ = useCategories()

  const flat = useMemo(() => {
    const out: Hit[] = []
    for (const b of map.buckets) {
      for (const r of b.restaurants) {
        out.push({
          id: r.id,
          display_name: r.display_name,
          tier: b.tier,
          category_name: r.category_name ?? null,
        })
      }
    }
    return out
  }, [map.buckets])

  const needle = normalize(qParam)
  const results = useMemo(() => {
    if (!needle) return []
    return flat.filter((h) => {
      const nm = normalize(h.display_name)
      const cat = h.category_name ? normalize(h.category_name) : ''
      return nm.includes(needle) || cat.includes(needle)
    })
  }, [flat, needle])

  const catalogNames = useMemo(() => {
    const rows = categoriesQ.data ?? []
    return rows.map((r) => r.name).filter(Boolean)
  }, [categoriesQ.data])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = draft.trim()
    setParams(next ? { q: next } : {}, { replace: true })
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-white pb-4">
      <BackHeader title="搜索门店" />

      <div className="border-b border-neutral-100 px-4 pb-3 pt-2">
        <div className="mb-2 flex items-center gap-2">
          <CityPicker />
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="店名或美食分类关键字"
              className="w-full rounded-full bg-neutral-100 py-2.5 pr-10 pl-10 text-sm outline-none placeholder:text-neutral-400"
              autoComplete="off"
              enterKeyHint="search"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white active:bg-neutral-800"
          >
            搜索
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-500">
          {showingDemo
            ? '当前含示例餐馆，可搜「火锅」「烧烤」或店名节选。连接 Supabase 后将包含你的真实足迹。'
            : '从我的食鉴图里匹配店名与分类关键词。'}
        </p>

        {!needle ? (
          <div className="mt-4 space-y-2">
            <p className="text-[12px] font-semibold text-neutral-700">快捷：美食分类词</p>
            <div className="flex flex-wrap gap-1.5">
              {(catalogNames.length > 0
                ? catalogNames.slice(0, 12)
                : ['火锅', '烧烤', '饭馆', '粉面', '小吃', '饮甜', '简餐']
              ).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => {
                    setDraft(kw)
                    setParams({ q: kw })
                  }}
                  className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-900 ring-1 ring-orange-100 active:bg-orange-100"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error && !showingDemo ? (
        <p className="px-4 pt-8 text-center text-sm text-rose-500">
          {(error as Error).message}
        </p>
      ) : null}

      {isLoading && !showingDemo && !error ? (
        <p className="py-14 text-center text-sm text-neutral-400">载入食鉴数据中…</p>
      ) : null}

      {needle && (
        <section className="px-4 pt-4">
          <p className="text-[12px] font-medium text-neutral-600">
            与「{qParam.trim()}」相关 ·{' '}
            <span className="tabular-nums text-orange-700">{results.length}</span> 条
          </p>
          {results.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              没有匹配的门店。换一个词试试，或在食鉴图中确认该店已在某档位出现。
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 inline-block text-sm font-medium text-orange-600"
              >
                回吐鉴图看看
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {results.map((h) => (
                <li key={`${h.tier}-${h.id}`}>
                  <Link
                    to={`/restaurants/${h.id}`}
                    className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-3 active:bg-neutral-50"
                  >
                    <div
                      className="size-11 shrink-0 rounded-lg ring-1 ring-black/10"
                      style={{ background: TIER_SOFT_VAR[h.tier] }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-neutral-900">{h.display_name}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {TIER_LABEL[h.tier]}档
                        {h.category_name ? ` · ${h.category_name}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-neutral-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
