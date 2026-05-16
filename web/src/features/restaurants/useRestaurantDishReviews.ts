import { useQuery } from '@tanstack/react-query'
import type { DishRow, Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export interface RestaurantDishReviewItem {
  id: string
  dish_id: string
  dish_name: string
  reviewer_nickname: string
  score: number | null
  comment: string | null
  image_url: string | null
  created_at: string
  /** 来自宿主实践档位 */
  store_tier: Tier
}

export function useRestaurantDishReviews(restaurantId: string | null) {
  return useQuery<RestaurantDishReviewItem[]>({
    queryKey: ['restaurant-dish-feed', restaurantId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const rid = restaurantId!
      const sb = getSupabase()

      const { data: prsRaw, error: e1 } = await sb
        .from('practice_records')
        .select('id, user_id, tier')
        .eq('restaurant_id', rid)
        .eq('is_public', true)
        .eq('is_active', true)

      if (e1) throw e1

      interface PrTier {
        id: string
        user_id: string
        tier: string
      }
      const prs = (prsRaw ?? []) as PrTier[]
      if (!prs.length) return []

      const prMap = new Map(prs.map((p) => [p.id, p]))
      const prIds = prs.map((p) => p.id)

      const { data: drRaw, error: e2 } = await sb
        .from('dish_reviews')
        .select('id,dish_id,score,comment,image_url,created_at,is_public,is_active,practice_record_id,dishes(id,name)')
        .in('practice_record_id', prIds)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(80)

      if (e2) throw e2

      const userIds = [...new Set(prs.map((p) => p.user_id))]
      const { data: nickRaw, error: e3 } = await sb
        .from('profiles')
        .select('id,nickname')
        .in('id', userIds)

      if (e3) throw e3

      type NickRow = { id: string; nickname: string | null }
      const nickBy = new Map((nickRaw as NickRow[] | null)?.map((n) => [n.id, n.nickname]))

      interface DrSel {
        id: string
        dish_id: string
        score: number | null
        comment: string | null
        image_url: string | null
        created_at: string
        practice_record_id: string
        dishes?: Pick<DishRow, 'id' | 'name'> | Pick<DishRow, 'id' | 'name'>[] | null
      }

      const out: RestaurantDishReviewItem[] = []
      for (const r of (drRaw ?? []) as DrSel[]) {
        const pr = prMap.get(r.practice_record_id)
        if (!pr) continue
        const d = r.dishes
        let dishName = '菜品'
        if (d && !Array.isArray(d) && d.name) dishName = d.name
        else if (Array.isArray(d) && d[0]?.name) dishName = d[0].name

        out.push({
          id: r.id,
          dish_id: r.dish_id,
          dish_name: dishName,
          reviewer_nickname: (nickBy.get(pr.user_id) ?? '食鉴用户').trim() || '食鉴用户',
          score: r.score,
          comment: r.comment,
          image_url: r.image_url,
          created_at: r.created_at,
          store_tier: pr.tier as Tier,
        })
      }

      return out
    },
  })
}
