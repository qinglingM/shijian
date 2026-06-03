import { useQuery } from '@tanstack/react-query'
import {
  Award,
  Bookmark,
  ChevronRight,
  FileText,
  KeyRound,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'
import { isRegisteredUser } from '@/features/auth/useRequireLogin'

interface MeActivityItem {
  id: string
  restaurantId: string
  restaurantName: string
  tier: string
  createdAt: string
}

interface MeSummary {
  profile: Pick<
    ProfileRow,
    | 'id'
    | 'user_code'
    | 'nickname'
    | 'avatar_url'
    | 'bio'
    | 'created_at'
    | 'phone'
    | 'phone_verified_at'
    | 'phone_binding_exempt'
    | 'is_profile_public'
  > & { current_title_id: string | null; title_name: string | null } | null
  practiceCount: number
  markCount: number
  totalMarkCount: number
  followersCount: number
  followingCount: number
  youpinCount: number
  recentActivities: MeActivityItem[]
}

interface MarkRestaurantRow {
  restaurant_id: string
}

export function MePage() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const userId = isRegisteredUser(user) ? user.id : null
  const { data } = useQuery<MeSummary>({
    queryKey: ['me-summary', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase()
      const [
        profileResult,
        equippedTitleResult,
        practiceResult,
        markResult,
        followersResult,
        followingResult,
        voteResult,
        recentPracticeResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, user_code, nickname, avatar_url, bio, created_at, phone, phone_verified_at, phone_binding_exempt, is_profile_public',
          )
          .eq('id', userId!)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('current_title_id, user_titles!current_title_id(title_id, titles!inner(name, rarity))')
          .eq('id', userId!)
          .maybeSingle(),
        supabase
          .from('practice_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .eq('is_active', true),
        supabase
          .from('marks')
          .select('restaurant_id')
          .eq('user_id', userId!),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId!),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId!),
        supabase
          .from('review_votes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .eq('vote_type', 'youpin'),
        supabase
          .from('practice_records')
          .select('id, restaurant_id, tier, created_at, restaurants(display_name)')
          .eq('user_id', userId!)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(3),
      ])

      if (profileResult.error) throw profileResult.error
      if (practiceResult.error) throw practiceResult.error
      if (markResult.error) throw markResult.error
      if (followersResult.error) throw followersResult.error
      if (followingResult.error) throw followingResult.error
      if (voteResult.error) throw voteResult.error
      if (recentPracticeResult.error) throw recentPracticeResult.error

      const markedRestaurantIds = [
        ...new Set(((markResult.data ?? []) as MarkRestaurantRow[]).map((row) => row.restaurant_id)),
      ]
      let reviewedMarkedRestaurantIds = new Set<string>()
      if (markedRestaurantIds.length) {
        const { data: reviewedMarks, error: reviewedMarksError } = await supabase
          .from('practice_records')
          .select('restaurant_id')
          .eq('user_id', userId!)
          .eq('is_valid_practice', true)
          .eq('is_active', true)
          .in('restaurant_id', markedRestaurantIds)

        if (reviewedMarksError) throw reviewedMarksError
        reviewedMarkedRestaurantIds = new Set(
          ((reviewedMarks ?? []) as MarkRestaurantRow[]).map((row) => row.restaurant_id),
        )
      }

      const recentActivities: MeActivityItem[] = (recentPracticeResult.data ?? []).map((row) => {
        const restaurantRaw = row.restaurants as { display_name?: string } | { display_name?: string }[] | null
        const restaurantName = Array.isArray(restaurantRaw)
          ? (restaurantRaw[0]?.display_name ?? '未知门店')
          : (restaurantRaw?.display_name ?? '未知门店')

        return {
          id: row.id,
          restaurantId: row.restaurant_id,
          restaurantName,
          tier: row.tier,
          createdAt: row.created_at,
        }
      })

      const raw = profileResult.data as Record<string, unknown> | null
      const titleRaw = equippedTitleResult.data as { current_title_id: string | null; user_titles?: { title_id: string; titles: { name: string; rarity: string } } } | null
      const title_name = titleRaw?.user_titles?.titles?.name ?? null
      const profile = raw ? {
        ...Object.fromEntries(
          ['id', 'user_code', 'nickname', 'avatar_url', 'bio', 'created_at', 'phone', 'phone_verified_at', 'phone_binding_exempt', 'is_profile_public']
            .map(k => [k, raw[k] ?? null])
        ),
        current_title_id: titleRaw?.current_title_id ?? null,
        title_name,
      } as MeSummary['profile'] : null

      return {
        profile,
        practiceCount: practiceResult.count ?? 0,
        markCount: markedRestaurantIds.filter((restaurantId) => !reviewedMarkedRestaurantIds.has(restaurantId)).length,
        totalMarkCount: markedRestaurantIds.length,
        followersCount: followersResult.count ?? 0,
        followingCount: followingResult.count ?? 0,
        youpinCount: voteResult.count ?? 0,
        recentActivities,
      }
    },
  })

  const profile = data?.profile
  const nickname = profile?.nickname || '食鉴用户'
  const userCode = profile?.user_code || 'SJ000000'

  if (pathname === '/me' && isSupabaseConfigured && !userId) {
    return <Navigate to="/auth?redirect=/me" replace />
  }

  return (
    <div className="bg-white px-5 py-5 overflow-y-auto" style={{ paddingTop: 'max(var(--safe-top), 1.25rem)' }}>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">个人中心</h1>
      <section className="relative overflow-hidden rounded-3xl border border-orange-200 bg-white p-4 shadow-sm shadow-orange-500/10">
        <div className="pointer-events-none absolute -top-16 -right-12 z-0 size-36 rounded-full border-[18px] border-pink-200/50" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 z-0 size-44 rounded-full border-[22px] border-orange-200/45" />
        <div className="relative z-[1] flex items-center gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={nickname}
              className="size-16 rounded-full border-2 border-white object-cover shadow-md shadow-orange-500/15 ring-2 ring-orange-200"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-orange-200 bg-orange-50 text-orange-600 shadow-md shadow-orange-500/10">
              <UserRound size={30} strokeWidth={1.7} />
            </div>
          )}
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-xl font-semibold text-neutral-950">{nickname}</p>
            <p className="mt-1 text-xs text-neutral-500">食鉴号 {userCode}</p>
            <p className="mt-2 line-clamp-1 text-xs text-neutral-500">
              {profile?.bio || '还没写个人签名，先用吃过的店说话。'}
            </p>
            {profile?.phone_binding_exempt ? (
              <p className="mt-2 text-[11px] font-medium text-amber-800">
                研发预留帐号 · 暂不强制绑定手机号
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative z-[1] mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-7 text-center">
            <StatCard label="食鉴" value={data?.practiceCount ?? 0} plain />
            <StatCard label="有品" value={data?.youpinCount ?? 0} plain />
          </div>
          <Link
            to="/me/edit"
            className="relative flex h-8 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-white px-3 text-[11px] font-medium text-orange-600 shadow-sm active:bg-orange-50"
            aria-label="编辑资料"
          >
            编辑资料
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-100 overflow-hidden">
        <FeatureCard
          to="/me/practices"
          icon={<FileText size={18} />}
          title="评价记录"
          desc={`${data?.practiceCount ?? 0} 条实践记录`}
        />
        <div className="border-b border-neutral-100" />
        <FeatureCard
          to="/me/marks"
          icon={<Bookmark size={18} />}
          title="我的标记"
          desc={`${data?.totalMarkCount ?? 0} 家门店`}
        />
        <div className="border-b border-neutral-100" />
        <FeatureCard
          to="/me/bole"
          icon={<UsersRound size={18} />}
          title="我的伯乐"
          desc="你作为伯乐被记录的门店"
        />
        <div className="border-b border-neutral-100" />
        <FeatureCard
          to="/me/titles"
          icon={<Award size={18} />}
          title="我的称号"
          desc={data?.profile?.title_name ?? '点击选择称号'}
        />
        <div className="border-b border-neutral-100" />
        <FeatureCard
          to="/me/settings"
          icon={<KeyRound size={18} />}
          title="应用设置"
          desc="隐私政策、用户协议与账号管理"
        />
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix = '',
  plain = false,
}: {
  label: string
  value: number
  suffix?: string
  plain?: boolean
}) {
  const text = `${Math.max(0, Math.trunc(value))}${suffix}`

  return (
    <div className={plain ? 'px-1 py-1' : 'rounded-2xl border border-orange-100 bg-white/80 px-2 py-2 shadow-sm'}>
      <p className="text-base font-semibold leading-none text-neutral-950">{text}</p>
      <p className="mt-0.5 text-[10px] leading-none text-orange-600">{label}</p>
    </div>
  )
}

function FeatureCard({
  to,
  icon,
  title,
  desc,
}: {
  to?: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  const content = (
    <div className="flex items-start gap-3 bg-white px-4 py-3 active:bg-neutral-50">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5 text-neutral-900">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{desc}</p>
      </div>
      <ChevronRight size={15} className="mt-1 shrink-0 text-neutral-400" />
    </div>
  )

  return to ? <Link to={to}>{content}</Link> : content
}
