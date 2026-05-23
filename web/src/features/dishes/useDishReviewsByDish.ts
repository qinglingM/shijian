import { useQuery } from '@tanstack/react-query'
import type { Tier, VoteType } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface DishReviewFeedItem {
  id: string
  reviewer_nickname: string
  created_at: string
  store_tier: Tier
  score: number | null
  comment: string | null
  image_url: string | null
  youpin_count: number
  yebang_count: number
  my_vote: VoteType | null
}

const ANONYMOUS_REVIEWER = '匿名食客'

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

interface ProfileSel {
  id: string
  nickname: string
  avatar_url: string | null
}

export function useDishReviewsByDish(dishId: string | null) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  return useQuery<DishReviewFeedItem[]>({
    queryKey: ['dish-reviews', dishId, viewerId],
    enabled: isSupabaseConfigured && !!dishId,
    queryFn: async () => {
      const did = dishId!
      const sb = getSupabase()

      const { data: drv, error: e1 } = await sb
        .from('dish_reviews')
        .select('id, score, comment, image_url, created_at, practice_record_id')
        .eq('dish_id', did)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(80)

      if (e1) throw e1
      const revs = (drv ?? []) as DrMini[]
      if (!revs.length) return []

      const prIds = [...new Set(revs.map((r) => r.practice_record_id))]

      const { data: prv, error: e2 } = await sb
        .from('practice_records')
        .select('id, tier, user_id, is_active')
        .in('id', prIds)
        .eq('is_active', true)

      if (e2) throw e2

      const practices = new Map(((prv ?? []) as PrMini[]).map((p) => [p.id, p]))

      // 查非匿名用户的 profile
      const allUserIds = [...new Set(
        ((prv ?? []) as PrMini[]).map((p) => p.user_id)
      )]
      const profileMap = new Map<string, ProfileSel>()
      if (allUserIds.length) {
        const { data: profilesRaw } = await sb
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', allUserIds)
        for (const p of (profilesRaw ?? []) as ProfileSel[]) {
          profileMap.set(p.id, p)
        }
      }

      const reviewIds = revs.map((r) => r.id)
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

      const items: DishReviewFeedItem[] = []
      for (const r of revs) {
        const pr = practices.get(r.practice_record_id)
        if (!pr) continue
        const votes = voteSummary.get(r.id) ?? { youpin: 0, yebang: 0, mine: null }

        const profile = profileMap.get(pr.user_id) ?? null
        items.push({
          id: r.id,
          reviewer_nickname: profile ? profile.nickname : ANONYMOUS_REVIEWER,
          created_at: r.created_at,
          store_tier: pr.tier as Tier,
          score: r.score,
          comment: r.comment,
          image_url: r.image_url,
          youpin_count: votes.youpin,
          yebang_count: votes.yebang,
          my_vote: votes.mine,
        })
      }

      return items
    },
  })
}
