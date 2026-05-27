import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bookmark,
  ChevronRight,
  KeyRound,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'

/** 与 AuthBootstrap 一致，用于退出失败时的提示文案 */
const FIXTURE_AUTO_LOGIN = import.meta.env.VITE_FIXTURE_AUTO_LOGIN === 'true'

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
  > | null
  practiceCount: number
  markCount: number
  titleCount: number
  followersCount: number
  followingCount: number
  youpinCount: number
  recentActivities: MeActivityItem[]
}

interface MarkRestaurantRow {
  restaurant_id: string
}

export function MePage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const setSession = useAuthStore((s) => s.setSession)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { data, isLoading } = useQuery<MeSummary>({
    queryKey: ['me-summary', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase()
      const [
        profileResult,
        practiceResult,
        markResult,
        titleResult,
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
          .from('practice_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .eq('is_active', true),
        supabase
          .from('marks')
          .select('restaurant_id')
          .eq('user_id', userId!),
        supabase
          .from('user_titles')
          .select('id', { count: 'exact', head: true })
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
      if (titleResult.error) throw titleResult.error
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

      return {
        profile: profileResult.data as MeSummary['profile'],
        practiceCount: practiceResult.count ?? 0,
        markCount: markedRestaurantIds.filter((restaurantId) => !reviewedMarkedRestaurantIds.has(restaurantId)).length,
        titleCount: titleResult.count ?? 0,
        followersCount: followersResult.count ?? 0,
        followingCount: followingResult.count ?? 0,
        youpinCount: voteResult.count ?? 0,
        recentActivities,
      }
    },
  })

  const profile = data?.profile
  const followersCount = data?.followersCount ?? 0
  const followingCount = data?.followingCount ?? 0
  const nickname = profile?.nickname || '食鉴用户'
  const userCode = profile?.user_code || 'SJ000000'

  if (isSupabaseConfigured && !userId) {
    return <Navigate to="/auth?redirect=/me" replace />
  }

  async function handleSignOut() {
    setSignOutError(null)
    setSigningOut(true)
    try {
      const sb = getSupabase()
      // 默认 global 会先请求服务端注销；请求失败且非 401/403/404 时，库里不会清空本地会话，表现为「点了退出却仍登录」
      let { error } = await sb.auth.signOut({ scope: 'global' })
      if (error) {
        console.warn('[shijian] signOut(global):', error.message)
        ;({ error } = await sb.auth.signOut({ scope: 'local' }))
        if (error) console.warn('[shijian] signOut(local):', error.message)
      }

      const { data: sessionData } = await sb.auth.getSession()
      if (!sessionData.session) {
        setSession(null)
        return
      }

      const hint =
        '仍然无法退出多半是：① 与服务器的连接被拦截或服务异常；② 浏览器开了多个本站标签页，另一端又自动登录成功。可先关掉其它标签再试。'
      const fixtureHint = FIXTURE_AUTO_LOGIN
        ? ` 若在 .env.local 里开启了「VITE_FIXTURE_AUTO_LOGIN=true」，刷新页面会再次自动用测试账号登录，这不是退出失败——请关掉该选项或删掉 fixture 帐号密码后再试刷新。`
        : ''
      setSignOutError(hint + fixtureHint)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="bg-white px-5 py-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
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
            <StatCard label="粉丝" value={followersCount} plain />
            <StatCard label="关注" value={followingCount} plain />
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

      <section className="mt-4 rounded-2xl border border-dashed border-neutral-200 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-800">近期动态</p>
          <span className="text-[11px] text-neutral-400">最近 3 条</span>
        </div>

        {isLoading ? (
          <p className="mt-3 text-xs text-neutral-400">加载中…</p>
        ) : (data?.recentActivities.length ?? 0) > 0 ? (
          <div className="mt-2.5 space-y-1.5">
            {data!.recentActivities.map((item) => (
              <Link
                key={item.id}
                to={`/restaurants/${item.restaurantId}`}
                className="block rounded-xl border border-neutral-100 bg-white px-3 py-2 active:bg-neutral-50"
              >
                <p className="text-xs font-medium text-neutral-800">
                  在「{item.restaurantName}」完成了 {tierLabel(item.tier)} 食鉴
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">{formatRelativeTime(item.createdAt)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 text-xs leading-5 text-neutral-400">暂无动态，去完成一次食鉴就会出现在这里。</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-100">
        <FeatureCard
          to="/me/marks"
          icon={<Bookmark size={18} />}
          title="想去 / 标记"
          desc={`${data?.markCount ?? 0} 家标记 · 分组：仍想去 / 已评价`}
        />
        <FeatureCard
          to="/me/bole"
          icon={<UsersRound size={18} />}
          title="我的伯乐"
          desc="你作为伯乐被记录的门店"
        />
        <FeatureCard
          to="/auth?mode=forgot&redirect=/me"
          icon={<KeyRound size={18} />}
          title="设置密码"
          desc="用手机验证码重置或设置登录密码"
        />
      </section>

      {isSupabaseConfigured && userId ? (
        <section className="mt-5 pb-2">
          {signOutError ? (
            <p className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-[11px] leading-5 text-orange-950">
              {signOutError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className="w-full rounded-2xl border border-neutral-200 py-3 text-sm text-neutral-600 active:bg-neutral-50 disabled:opacity-50"
          >
            {signingOut ? '退出中…' : '退出登录'}
          </button>
        </section>
      ) : null}

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-28 sm:items-center sm:pb-8">
          <div
            role="dialog"
            aria-labelledby="logout-confirm-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <p id="logout-confirm-title" className="text-base font-medium text-neutral-900">
              确认退出登录？
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-500">退出后仍可随时使用手机号与密码重新登录。</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm text-neutral-700"
                onClick={() => setShowLogoutConfirm(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-medium text-white shadow-sm"
                onClick={() => {
                  setShowLogoutConfirm(false)
                  void handleSignOut()
                }}
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    <div className="flex items-start gap-3 border-b border-neutral-100 bg-white px-4 py-3 last:border-b-0 active:bg-neutral-50">
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

function tierLabel(tier: string) {
  const map: Record<string, string> = {
    boom: '夯爆了',
    hang: '夯',
    top: '顶级',
    upper: '人上人',
    npc: 'NPC',
    bad: '拉完了',
  }
  return map[tier] ?? tier
}

function formatRelativeTime(dateString: string) {
  const time = new Date(dateString).getTime()
  if (Number.isNaN(time)) return '刚刚'

  const diffMs = Date.now() - time
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute))
    return `${mins} 分钟前`
  }
  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour))
    return `${hours} 小时前`
  }
  const days = Math.max(1, Math.floor(diffMs / day))
  return `${days} 天前`
}
