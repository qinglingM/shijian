import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

interface RestMini {
  id: string
  display_name: string | null
  cover_image_url: string | null
}

export interface MyMarksWantRow {
  mark_id: string
  restaurant_id: string
  display_name: string
  cover_image_url: string | null
  marked_at: string
}

export interface MyMarksReviewedRow {
  restaurant_id: string
  display_name: string
  cover_image_url: string | null
  last_practice_at: string
}

interface MarksFeedPack {
  want: MyMarksWantRow[]
  reviewed: MyMarksReviewedRow[]
}

export function useMyMarksFeed(userId: string | null) {
  return useQuery<MarksFeedPack>({
    queryKey: ['my-marks-feed', userId],
    enabled: isSupabaseConfigured && !!userId,
    queryFn: async () => {
      const uid = userId!
      const sb = getSupabase()

      const [{ data: mrows, error: e1 }, { data: proofs, error: e2 }] = await Promise.all([
        sb
          .from('marks')
          .select(
            `
            id,
            created_at,
            restaurant_id,
            restaurants (
              display_name,
              cover_image_url
            )
          `,
          )
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        sb
          .from('practice_records')
          .select('restaurant_id, valid_practice_at, created_at')
          .eq('user_id', uid)
          .eq('is_valid_practice', true)
          .eq('is_active', true),
      ])

      if (e1) throw e1
      if (e2) throw e2

      interface PrRow {
        restaurant_id: string
        valid_practice_at: string | null
        created_at: string
      }
      const practicedAt = new Map<string, string>()
      for (const row of (proofs ?? []) as PrRow[]) {
        const t = row.valid_practice_at ?? row.created_at
        const prev = practicedAt.get(row.restaurant_id)
        if (!prev || prev.localeCompare(t) < 0) practicedAt.set(row.restaurant_id, t)
      }

      interface MarkNest {
        restaurants:
          | { display_name: string; cover_image_url: string | null }
          | { display_name: string; cover_image_url: string | null }[]
          | null
      }

      interface MarkSel extends MarkNest {
        id: string
        created_at: string
        restaurant_id: string
      }

      const want: MyMarksWantRow[] = []
      for (const row of (mrows ?? []) as unknown as MarkSel[]) {
        if (practicedAt.has(row.restaurant_id)) continue
        const rs = row.restaurants
        const r = rs && Array.isArray(rs) ? rs[0] : rs
        want.push({
          mark_id: row.id,
          restaurant_id: row.restaurant_id,
          display_name: r?.display_name ?? '未知门店',
          cover_image_url: r?.cover_image_url ?? null,
          marked_at: row.created_at,
        })
      }

      const reviewedIds = [...new Set(Array.from(practicedAt.keys()))]
      let restMap = new Map<string, RestMini>()

      if (reviewedIds.length) {
        const { data: rr, error: e3 } = await sb
          .from('restaurants')
          .select('id, display_name, cover_image_url')
          .in('id', reviewedIds)
        if (e3) throw e3
        restMap = new Map(((rr ?? []) as RestMini[]).map((x) => [x.id, x]))
      }

      const reviewed: MyMarksReviewedRow[] = [...practicedAt.entries()]
        .map(([rid, ts]) => {
          const rr = restMap.get(rid)
          return {
            restaurant_id: rid,
            display_name: rr?.display_name ?? '未知门店',
            cover_image_url: rr?.cover_image_url ?? null,
            last_practice_at: ts,
          }
        })
        .sort((a, b) => b.last_practice_at.localeCompare(a.last_practice_at))

      return { want, reviewed }
    },
  })
}
