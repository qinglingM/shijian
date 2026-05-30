import { useQuery } from '@tanstack/react-query'
import type { DishRow, Tier, VoteType } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface RestaurantDishReviewItem {
  id: string
  dish_id: string
  dish_name: string
  dish_cover_image_url: string | null
  reviewer_nickname: string
  titleName: string | null
  titleRarity: string | null
  score: number | null
  comment: string | null
  image_url: string | null
  created_at: string
  /** 来自宿主实践档位 */
  store_tier: Tier
  youpin_count: number
  yebang_count: number
  my_vote: VoteType | null
}

const ANONYMOUS_REVIEWER = '匿名食客'

interface ProfileSel {
  id: string
  nickname: string
  avatar_url: string | null
  current_title_id: string | null
}

export function useRestaurantDishReviews(restaurantId: string | null) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  return useQuery<RestaurantDishReviewItem[]>({
    queryKey: ['restaurant-dish-feed', restaurantId, viewerId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const rid = restaurantId!
      const sb = getSupabase()

      const { data: prsRaw, error: e1 } = await sb
        .from('practice_records')
        .select('id, user_id, tier')
        .eq('restaurant_id', rid)
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

      // 查评价用户的 profile
      const allUserIds = [...new Set(prs.map((p) => p.user_id))]
      const profileMap = new Map<string, ProfileSel>()
      if (allUserIds.length) {
        const { data: profilesRaw } = await sb
          .from('profiles')
          .select('id, nickname, avatar_url, current_title_id')
          .in('id', allUserIds)
        for (const p of (profilesRaw ?? []) as ProfileSel[]) {
          profileMap.set(p.id, p)
        }
      }

      const titleIds = [...new Set([...profileMap.values()].map(p => p.current_title_id).filter(Boolean))] as string[]
      const titleMap = new Map<string, { name: string; rarity: string }>()
      if (titleIds.length > 0) {
        const { data: utRows } = await sb.from('user_titles').select('id, title_id, titles!inner(name, rarity)').in('id', titleIds)
        for (const ut of (utRows ?? []) as Array<{id: string; titles: {name: string; rarity: string}[]}>) {
          if (ut.titles?.[0]) titleMap.set(ut.id, { name: ut.titles[0].name, rarity: ut.titles[0].rarity })
        }
      }

      const { data: drRaw, error: e2 } = await sb
        .from('dish_reviews')
        .select('id,dish_id,score,comment,image_url,created_at,is_public,is_active,practice_record_id,dishes(id,name,cover_image_url)')
        .in('practice_record_id', prIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(80)

      if (e2) throw e2

      interface DrSel {
        id: string
        dish_id: string
        score: number | null
        comment: string | null
        image_url: string | null
        created_at: string
        practice_record_id: string
        dishes?: Pick<DishRow, 'id' | 'name' | 'cover_image_url'> | Pick<DishRow, 'id' | 'name' | 'cover_image_url'>[] | null
      }

      const reviewIds = ((drRaw ?? []) as DrSel[]).map((r) => r.id)
      if (!reviewIds.length) return []
      const { data: voteRaw, error: e4 } = await sb
        .from('review_votes')
        .select('user_id,target_id,vote_type')
        .eq('target_type', 'dish_review')
        .in('target_id', reviewIds)

      if (e4) throw e4

      type VoteRow = { user_id: string; target_id: string; vote_type: VoteType }
      const voteSummary = new Map<string, { youpin: number; yebang: number; mine: VoteType | null }>()
      for (const v of (voteRaw ?? []) as VoteRow[]) {
        const cur = voteSummary.get(v.target_id) ?? { youpin: 0, yebang: 0, mine: null }
        if (v.vote_type === 'youpin') cur.youpin += 1
        if (v.vote_type === 'yebang') cur.yebang += 1
        if (viewerId && v.user_id === viewerId) cur.mine = v.vote_type
        voteSummary.set(v.target_id, cur)
      }

      const out: RestaurantDishReviewItem[] = []
      for (const r of (drRaw ?? []) as DrSel[]) {
        const pr = prMap.get(r.practice_record_id)
        if (!pr) continue
        const d = r.dishes
        let dishName = '菜品'
        let dishCover: string | null = null
        if (d && !Array.isArray(d)) {
          if (d.name) dishName = d.name
          dishCover = d.cover_image_url ?? null
        } else if (Array.isArray(d) && d[0]) {
          if (d[0].name) dishName = d[0].name
          dishCover = d[0].cover_image_url ?? null
        }
        const votes = voteSummary.get(r.id) ?? { youpin: 0, yebang: 0, mine: null }

        const profile = profileMap.get(pr.user_id) ?? null
        out.push({
          id: r.id,
          dish_id: r.dish_id,
          dish_name: dishName,
          dish_cover_image_url: dishCover,
          reviewer_nickname: profile ? profile.nickname : ANONYMOUS_REVIEWER,
          titleName: titleMap.get(profile?.current_title_id ?? '')?.name ?? null,
          titleRarity: titleMap.get(profile?.current_title_id ?? '')?.rarity ?? null,
          score: r.score,
          comment: r.comment,
          image_url: r.image_url,
          created_at: r.created_at,
          store_tier: pr.tier as Tier,
          youpin_count: votes.youpin,
          yebang_count: votes.yebang,
          my_vote: votes.mine,
        })
      }

      return out
    },
  })
}
