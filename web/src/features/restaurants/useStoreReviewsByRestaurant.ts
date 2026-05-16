import { useQuery } from '@tanstack/react-query'
import type { Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'

export interface StoreReviewItem {
  id: string
  nickname: string
  avatar_url: string | null
  tier: Tier
  store_comment: string | null
  created_at: string
  youpin_count: number
  yebang_count: number
  my_vote: VoteType | null
}

interface PracticeSel {
  id: string
  tier: string
  store_comment: string | null
  created_at: string
  user_id: string
}

interface VoteSel {
  target_id: string
  vote_type: VoteType
  user_id: string
}

interface ProfileMini {
  id: string
  nickname: string | null
  avatar_url: string | null
}

export function useStoreReviewsByRestaurant(restaurantId: string | null) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null)

  return useQuery<StoreReviewItem[]>({
    queryKey: ['store-reviews', restaurantId, viewerId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const rid = restaurantId!
      const sb = getSupabase()

      const { data: prow, error: e1 } = await sb
        .from('practice_records')
        .select('id, tier, store_comment, created_at, user_id')
        .eq('restaurant_id', rid)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(120)

      if (e1) throw e1
      const prs = (prow ?? []) as PracticeSel[]
      if (!prs.length) return []

      const uids = [...new Set(prs.map((r) => r.user_id))]
      const [{ data: profsRaw, error: e2 }, { data: votesRaw, error: e3 }] = await Promise.all([
        sb.from('profiles').select('id,nickname,avatar_url').in('id', uids),
        sb
          .from('review_votes')
          .select('target_id, vote_type, user_id')
          .eq('target_type', 'store_review')
          .in(
            'target_id',
            prs.map((p) => p.id),
          ),
      ])

      if (e2) throw e2
      if (e3) throw e3

      const profById = new Map<string, ProfileMini>()
      for (const p of (profsRaw ?? []) as ProfileMini[]) profById.set(p.id, p)

      const yCount = new Map<string, number>()
      const bCount = new Map<string, number>()
      const mineVote = new Map<string, VoteType>()
      for (const v of (votesRaw ?? []) as VoteSel[]) {
        if (v.vote_type === 'youpin') yCount.set(v.target_id, (yCount.get(v.target_id) ?? 0) + 1)
        if (v.vote_type === 'yebang') bCount.set(v.target_id, (bCount.get(v.target_id) ?? 0) + 1)
        if (viewerId && v.user_id === viewerId) mineVote.set(v.target_id, v.vote_type)
      }

      return prs.map((r) => {
        const prof = profById.get(r.user_id)
        return {
          id: r.id,
          nickname: prof?.nickname?.trim() || '食鉴用户',
          avatar_url: prof?.avatar_url ?? null,
          tier: r.tier as Tier,
          store_comment: r.store_comment,
          created_at: r.created_at,
          youpin_count: yCount.get(r.id) ?? 0,
          yebang_count: bCount.get(r.id) ?? 0,
          my_vote: mineVote.get(r.id) ?? null,
        }
      })
    },
  })
}
