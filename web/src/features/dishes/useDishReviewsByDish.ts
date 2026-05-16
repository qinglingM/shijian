import { useQuery } from '@tanstack/react-query'
import type { Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export interface DishReviewFeedItem {
  id: string
  reviewer_nickname: string
  created_at: string
  store_tier: Tier
  score: number | null
  comment: string | null
  image_url: string | null
}

interface DrMini {
  id: string
  score: number | null
  comment: string | null
  image_url: string | null
  created_at: string
  practice_record_id: string
}

interface PrMini {
  id: string
  tier: string
  user_id: string
}

export function useDishReviewsByDish(dishId: string | null) {
  return useQuery<DishReviewFeedItem[]>({
    queryKey: ['dish-reviews', dishId],
    enabled: isSupabaseConfigured && !!dishId,
    queryFn: async () => {
      const did = dishId!
      const sb = getSupabase()

      const { data: drv, error: e1 } = await sb
        .from('dish_reviews')
        .select('id, score, comment, image_url, created_at, practice_record_id')
        .eq('dish_id', did)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(80)

      if (e1) throw e1
      const revs = (drv ?? []) as DrMini[]
      if (!revs.length) return []

      const prIds = [...new Set(revs.map((r) => r.practice_record_id))]

      const { data: prv, error: e2 } = await sb
        .from('practice_records')
        .select('id, tier, user_id, is_public, is_active')
        .in('id', prIds)
        .eq('is_public', true)
        .eq('is_active', true)

      if (e2) throw e2

      const practices = new Map(((prv ?? []) as PrMini[]).map((p) => [p.id, p]))
      const uids = [...new Set([...practices.values()].map((p) => p.user_id))]
      const { data: pok, error: e3 } = await sb.from('profiles').select('id,nickname').in('id', uids)

      if (e3) throw e3

      type P = { id: string; nickname: string | null }
      const nib = new Map<string, string | null>((pok as P[])?.map((p) => [p.id, p.nickname]))

      const items: DishReviewFeedItem[] = []
      for (const r of revs) {
        const pr = practices.get(r.practice_record_id)
        if (!pr) continue

        items.push({
          id: r.id,
          reviewer_nickname: (nib.get(pr.user_id) ?? '食鉴用户').trim() || '食鉴用户',
          created_at: r.created_at,
          store_tier: pr.tier as Tier,
          score: r.score,
          comment: r.comment,
          image_url: r.image_url,
        })
      }

      return items
    },
  })
}
