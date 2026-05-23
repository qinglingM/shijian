import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { TIER_LABEL, type Tier, type VoteType } from '@/lib/db'

export interface SquareFeedItem {
  id: string
  created_at: string
  user_id: string
  nickname: string
  avatar_url: string | null
  content: string
  tier: Tier
  tier_label: string
  youpin_count: number
  yebang_count: number
  my_vote: VoteType | null
  restaurant_id: string
  restaurant_name: string
  city_name: string | null
  category_label: string | null
  amap_mid_category: string | null
  amap_small_category: string | null
}

interface ProfileMini {
  id: string
  nickname: string | null
  avatar_url: string | null
}

export function useSquareFeed() {
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  return useQuery<SquareFeedItem[]>({
    queryKey: ['square-feed', viewerId],
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    queryFn: async () => {
      const sb = getSupabase()

      const { data: practiceRows, error: pe } = await sb
        .from('practice_records')
        .select('id,user_id,restaurant_id,tier,store_comment,created_at')
        .eq('is_public', true)
        .eq('is_active', true)
        .not('store_comment', 'is', null)
        .neq('store_comment', '')
        .order('created_at', { ascending: false })
        .limit(40)
      if (pe) throw pe

      const prs = (practiceRows ?? []) as Array<{ id: string; user_id: string; restaurant_id: string; tier: string; store_comment: string | null; created_at: string }>
      const uids = [...new Set(prs.map((r) => r.user_id))]
      const rids = [...new Set(prs.map((r) => r.restaurant_id))]

      const [{ data: profsRaw, error: profErr }, { data: restaurantsRaw, error: restErr }, { data: votesRaw, error: voteErr }] = await Promise.all([
        sb.from('profiles').select('id,nickname,avatar_url').in('id', uids),
        rids.length
          ?           sb.from('restaurants').select('id,display_name,city_name,display_category_label,amap_mid_category,amap_small_category').in('id', rids)
          : Promise.resolve({ data: [], error: null } as const),
        sb.from('review_votes').select('target_id,vote_type,user_id').eq('target_type', 'store_review').in('target_id', prs.map((p) => p.id)),
      ])
      if (profErr) throw profErr
      if (restErr) throw restErr
      if (voteErr) throw voteErr

      const profs = new Map<string, ProfileMini>()
      for (const p of (profsRaw ?? []) as ProfileMini[]) profs.set(p.id, p)
      const rests = new Map<string, { display_name: string; city_name: string | null; display_category_label: string | null; amap_mid_category: string | null; amap_small_category: string | null }>()
      for (const r of (restaurantsRaw ?? []) as Array<{ id: string; display_name: string; city_name: string | null; display_category_label: string | null; amap_mid_category: string | null; amap_small_category: string | null }>) rests.set(r.id, r)

      const y = new Map<string, number>()
      const b = new Map<string, number>()
      const mine = new Map<string, VoteType>()
      for (const v of (votesRaw ?? []) as Array<{ target_id: string; vote_type: VoteType; user_id: string }>) {
        if (v.vote_type === 'youpin') y.set(v.target_id, (y.get(v.target_id) ?? 0) + 1)
        if (v.vote_type === 'yebang') b.set(v.target_id, (b.get(v.target_id) ?? 0) + 1)
        if (viewerId && v.user_id === viewerId) mine.set(v.target_id, v.vote_type)
      }

      return prs.map((r) => {
        const prof = profs.get(r.user_id)
        const rest = rests.get(r.restaurant_id)
        return {
          id: r.id,
          created_at: r.created_at,
          user_id: r.user_id,
          nickname: prof?.nickname?.trim() || '食鉴用户',
          avatar_url: prof?.avatar_url ?? null,
          content: r.store_comment ?? '',
          tier: r.tier as Tier,
          tier_label: TIER_LABEL[r.tier as Tier],
          youpin_count: y.get(r.id) ?? 0,
          yebang_count: b.get(r.id) ?? 0,
          my_vote: mine.get(r.id) ?? null,
          restaurant_id: r.restaurant_id,
          restaurant_name: rest?.display_name || '未知门店',
          city_name: rest?.city_name ?? null,
          category_label: rest?.display_category_label ?? null,
          amap_mid_category: rest?.amap_mid_category ?? null,
          amap_small_category: rest?.amap_small_category ?? null,
        }
      })
    },
  })
}
