import { useQuery } from '@tanstack/react-query'
import type { Tier } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { withStoreReviewTestFixtures } from '@/features/reports/reportTestFixtures'
import { useAuthStore } from '@/stores/authStore'
import type { VoteType } from '@/lib/db'

export interface StoreReviewItem {
  id: string
  nickname: string
  avatar_url: string | null
  titleName: string | null
  titleRarity: string | null
  tier: Tier
  store_comment: string | null
  created_at: string
  youpin_count: number
  yebang_count: number
  my_vote: VoteType | null
  user_id: string
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

interface ProfileSel {
  id: string
  nickname: string
  avatar_url: string | null
  current_title_id: string | null
}

const ANONYMOUS_REVIEWER = '匿名食客'

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
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(120)

      if (e1) throw e1
      const prs = (prow ?? []) as PracticeSel[]
      if (!prs.length) return []

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
        for (const ut of (utRows ?? []) as unknown as Array<{id: string; titles: {name: string; rarity: string}}>) {
          const t = ut.titles
          if (t?.name) titleMap.set(ut.id, { name: t.name, rarity: t.rarity })
        }
      }

      const { data: votesRaw, error: e3 } = await sb
        .from('review_votes')
        .select('target_id, vote_type, user_id')
        .eq('target_type', 'store_review')
        .in(
          'target_id',
          prs.map((p) => p.id),
        )

      if (e3) throw e3

      const yCount = new Map<string, number>()
      const bCount = new Map<string, number>()
      const mineVote = new Map<string, VoteType>()
      for (const v of (votesRaw ?? []) as VoteSel[]) {
        if (v.vote_type === 'youpin') yCount.set(v.target_id, (yCount.get(v.target_id) ?? 0) + 1)
        if (v.vote_type === 'yebang') bCount.set(v.target_id, (bCount.get(v.target_id) ?? 0) + 1)
        if (viewerId && v.user_id === viewerId) mineVote.set(v.target_id, v.vote_type)
      }

      const items = prs.map((r) => {
        const profile = profileMap.get(r.user_id) ?? null
        return {
          id: r.id,
          user_id: r.user_id,
          nickname: profile ? profile.nickname : ANONYMOUS_REVIEWER,
          avatar_url: profile ? profile.avatar_url : null,
          titleName: titleMap.get(profile?.current_title_id ?? '')?.name ?? null,
          titleRarity: titleMap.get(profile?.current_title_id ?? '')?.rarity ?? null,
          tier: r.tier as Tier,
          store_comment: r.store_comment,
          created_at: r.created_at,
          youpin_count: yCount.get(r.id) ?? 0,
          yebang_count: bCount.get(r.id) ?? 0,
          my_vote: mineVote.get(r.id) ?? null,
        }
      })
      return withStoreReviewTestFixtures(items)
    },
  })
}
