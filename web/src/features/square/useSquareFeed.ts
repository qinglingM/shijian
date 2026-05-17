import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { TIER_LABEL, type Tier, type VoteType } from '@/lib/db'
import { useRestaurant } from '@/features/restaurants/useRestaurant'
import type { StoreReviewItem } from '@/features/restaurants/useStoreReviewsByRestaurant'

export type SquareFeedItem =
  | {
      id: string
      kind: 'practice'
      created_at: string
      user_id: string
      nickname: string
      avatar_url: string | null
      title: string
      content: string
      cover_style: 'tier'
      tier: Tier
      tier_label: string
      youpin_count: number
      yebang_count: number
      my_vote: VoteType | null
      restaurant_id: string
      restaurant_name: string
    }
  | {
      id: string
      kind: 'post'
      created_at: string
      user_id: string
      nickname: string
      avatar_url: string | null
      title: string
      content: string
      cover_style: 'image'
      cover_image_url: string | null
      youpin_count: number
      yebang_count: number
      my_vote: VoteType | null
    }

interface PostRow {
  id: string
  user_id: string
  title: string
  content: string
  cover_image_url: string | null
  created_at: string
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
    queryFn: async () => {
      const sb = getSupabase()
      const [{ data: practiceRows, error: pe }, { data: postRows, error: po }] = await Promise.all([
        sb
          .from('practice_records')
          .select('id,user_id,restaurant_id,tier,store_comment,created_at')
          .eq('is_public', true)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(40),
        sb
          .from('posts')
          .select('id,user_id,title,content,cover_image_url,created_at')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(40),
      ])
      if (pe) throw pe
      if (po) throw po

      const prs = (practiceRows ?? []) as Array<{ id: string; user_id: string; restaurant_id: string; tier: string; store_comment: string | null; created_at: string }>
      const posts = (postRows ?? []) as PostRow[]
      const uids = [...new Set([...prs.map((r) => r.user_id), ...posts.map((r) => r.user_id)])]
      const rids = [...new Set(prs.map((r) => r.restaurant_id))]

      const [{ data: profsRaw, error: profErr }, { data: restaurantsRaw, error: restErr }, { data: votesRaw, error: voteErr }] = await Promise.all([
        sb.from('profiles').select('id,nickname,avatar_url').in('id', uids),
        rids.length
          ? sb.from('restaurants').select('id,display_name').in('id', rids)
          : Promise.resolve({ data: [], error: null } as const),
        sb.from('review_votes').select('target_id,vote_type,user_id,target_type').in('target_type', ['store_review', 'post']).in('target_id', [...prs.map((p) => p.id), ...posts.map((p) => p.id)]),
      ])
      if (profErr) throw profErr
      if (restErr) throw restErr
      if (voteErr) throw voteErr

      const profs = new Map<string, ProfileMini>()
      for (const p of (profsRaw ?? []) as ProfileMini[]) profs.set(p.id, p)
      const rests = new Map<string, { display_name: string }>()
      for (const r of (restaurantsRaw ?? []) as Array<{ id: string; display_name: string }>) rests.set(r.id, r)

      const y = new Map<string, number>()
      const b = new Map<string, number>()
      const mine = new Map<string, VoteType>()
      for (const v of (votesRaw ?? []) as Array<{ target_id: string; vote_type: VoteType; user_id: string; target_type: string }>) {
        if (v.vote_type === 'youpin') y.set(v.target_id, (y.get(v.target_id) ?? 0) + 1)
        if (v.vote_type === 'yebang') b.set(v.target_id, (b.get(v.target_id) ?? 0) + 1)
        if (viewerId && v.user_id === viewerId) mine.set(v.target_id, v.vote_type)
      }

      const practiceFeed: SquareFeedItem[] = prs.map((r) => {
        const prof = profs.get(r.user_id)
        const rest = rests.get(r.restaurant_id)
        return {
          id: `practice:${r.id}`,
          kind: 'practice',
          created_at: r.created_at,
          user_id: r.user_id,
          nickname: prof?.nickname?.trim() || '食鉴用户',
          avatar_url: prof?.avatar_url ?? null,
          title: rest?.display_name || '未知门店',
          content: r.store_comment?.trim() || '（未填写店铺锐评）',
          cover_style: 'tier',
          tier: r.tier as Tier,
          tier_label: TIER_LABEL[r.tier as Tier],
          youpin_count: y.get(r.id) ?? 0,
          yebang_count: b.get(r.id) ?? 0,
          my_vote: mine.get(r.id) ?? null,
          restaurant_id: r.restaurant_id,
          restaurant_name: rest?.display_name || '未知门店',
        }
      })

      const postFeed: SquareFeedItem[] = posts.map((r) => {
        const prof = profs.get(r.user_id)
        return {
          id: `post:${r.id}`,
          kind: 'post',
          created_at: r.created_at,
          user_id: r.user_id,
          nickname: prof?.nickname?.trim() || '食鉴用户',
          avatar_url: prof?.avatar_url ?? null,
          title: r.title,
          content: r.content,
          cover_style: 'image',
          cover_image_url: r.cover_image_url,
          youpin_count: y.get(r.id) ?? 0,
          yebang_count: b.get(r.id) ?? 0,
          my_vote: mine.get(r.id) ?? null,
        }
      })

      return [...practiceFeed, ...postFeed].sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
  })
}
