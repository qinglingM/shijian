import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Award,
  Bookmark,
  ChevronRight,
  Edit3,
  MapPinned,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { maskPhoneDisplay } from '@/lib/maskPhone'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'

/** 与 AuthBootstrap 一致，用于退出失败时的提示文案 */
const FIXTURE_AUTO_LOGIN = import.meta.env.VITE_FIXTURE_AUTO_LOGIN === 'true'
const EMAIL_AUTH_ENABLED = import.meta.env.VITE_ENABLE_EMAIL_AUTH === 'true'

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
      const [profileResult, practiceResult, markResult, titleResult, followersResult, followingResult] = await Promise.all([
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
          .select('id', { count: 'exact', head: true })
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
      ])

      if (profileResult.error) throw profileResult.error
      if (practiceResult.error) throw practiceResult.error
      if (markResult.error) throw markResult.error
      if (titleResult.error) throw titleResult.error
      if (followersResult.error) throw followersResult.error
      if (followingResult.error) throw followingResult.error

      return {
        profile: profileResult.data as MeSummary['profile'],
        practiceCount: practiceResult.count ?? 0,
        markCount: markResult.count ?? 0,
        titleCount: titleResult.count ?? 0,
        followersCount: followersResult.count ?? 0,
        followingCount: followingResult.count ?? 0,
      }
    },
  })

  const profile = data?.profile
  const followersCount = data?.followersCount ?? 0
  const followingCount = data?.followingCount ?? 0
  const nickname = profile?.nickname || '食鉴用户'
  const userCode = profile?.user_code || 'SJ000000'
  const joinedDays: number | null = isLoading
    ? null
    : profile?.created_at
      ? daysSince(profile.created_at)
      : 0

  if (isSupabaseConfigured && !userId) {
    return (
      <div className="bg-white px-5 py-10">
        <section className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-6 shadow-sm">
          <div className="flex size-14 items-center justify-center rounded-full bg-white text-orange-600 shadow ring-1 ring-orange-100">
            <UserRound size={32} strokeWidth={1.7} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">还未登录</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            登录后可同步「想去」标记、撰写食鉴、查看伯乐与称号进度。
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/auth?redirect=/me"
              className="block rounded-xl bg-neutral-900 py-3 text-center text-sm font-medium text-white shadow-sm"
            >
              登录
            </Link>
            <Link
              to="/auth?redirect=/me&mode=signup"
              className="block rounded-xl border border-orange-200 bg-white py-3 text-center text-sm font-medium text-orange-700 shadow-sm"
            >
              注册新账号
            </Link>
            {EMAIL_AUTH_ENABLED ? (
              <Link
                to="/auth?redirect=/me&mode=signup&channel=email"
                className="block text-center text-xs text-neutral-500 underline underline-offset-2"
              >
                使用研发邮箱注册（可选）
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    )
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
    <div className="bg-white px-5 py-6">
      <section className="relative overflow-hidden rounded-3xl border border-orange-200 bg-white p-5 shadow-sm shadow-orange-500/10">
        <div className="pointer-events-none absolute -top-16 -right-12 size-36 rounded-full border-[18px] border-pink-200/50" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full border-[22px] border-orange-200/45" />
        <div className="flex items-center gap-4">
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
            {profile?.phone ? (
              <p className="mt-2 text-[11px] text-neutral-600">
                手机 {maskPhoneDisplay(profile.phone)}
                {profile.phone_verified_at ? (
                  <span className="text-neutral-400">（已验证）</span>
                ) : (
                  <span className="text-amber-700">（待短信验证）</span>
                )}
              </p>
            ) : profile && !profile.phone_binding_exempt ? (
              <p className="mt-2 text-[11px] text-neutral-400">未绑定手机号 · 正式版将支持短信验证</p>
            ) : null}
          </div>
          <Link
            to="/me/edit"
            className="relative rounded-full border border-orange-200 bg-white p-2 text-orange-600 shadow-sm active:bg-orange-50"
            aria-label="编辑资料"
          >
            <Edit3 size={16} />
          </Link>
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-2 text-center">
          <StatCard label="食鉴" value={data?.practiceCount ?? null} loading={isLoading} />
          <StatCard label="来食鉴" value={joinedDays} suffix="天" loading={isLoading} />
          <StatCard label="粉丝" value={followersCount} loading={isLoading} />
          <StatCard label="关注" value={followingCount} loading={isLoading} />
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-neutral-50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-neutral-500" />
          <h2 className="text-sm font-medium text-neutral-900">我的食鉴进度</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ProgressTile
            to="/"
            icon={<MapPinned size={16} />}
            title="食鉴图"
            value="去首页看地图"
            hint="六档分店，与首页同步"
          />
          <ProgressTile
            icon={<Award size={16} />}
            title="称号墙"
            value={`${data?.titleCount ?? 0} 枚`}
            hint="吃出来的身份"
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-100">
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
          icon={<Award size={18} />}
          title="我的称号"
          desc={`${data?.titleCount ?? 0} 个已解锁`}
        />
        <FeatureCard
          icon={<Settings size={18} />}
          title="偏好设置"
          desc="城市、隐私、通知"
        />
      </section>

      <section className="mt-5 rounded-3xl border border-dashed border-neutral-200 p-5 text-center">
        <p className="text-sm font-medium text-neutral-800">近期动态</p>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          你完成食鉴后，这里会出现最近评价、解锁的称号等动态。
        </p>
      </section>

      {isSupabaseConfigured && userId ? (
        <section className="mt-6 pb-2">
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
                className="flex-1 rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white"
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
  loading,
}: {
  label: string
  value: number | null
  suffix?: string
  loading: boolean
}) {
  const text = loading || value === null ? '—' : `${value}${suffix}`

  return (
    <div className="rounded-2xl border border-orange-100 bg-white/80 px-2 py-2 shadow-sm">
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
    <div className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-3 last:border-b-0 active:bg-neutral-50">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="mt-0.5 text-[11px] text-neutral-500">{desc}</p>
      </div>
      <ChevronRight size={15} className="shrink-0 text-neutral-400" />
    </div>
  )

  return to ? <Link to={to}>{content}</Link> : content
}

function ProgressTile({
  to,
  icon,
  title,
  value,
  hint,
}: {
  to?: string
  icon: React.ReactNode
  title: string
  value: string
  hint: string
}) {
  const inner = (
    <div className="rounded-2xl bg-white p-3 text-left transition-colors active:bg-neutral-50">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-base font-semibold leading-snug text-neutral-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>
    </div>
  )

  return to ? (
    <Link to={to} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
      {inner}
    </Link>
  ) : (
    inner
  )
}

function daysSince(dateString: string) {
  const created = new Date(dateString).getTime()
  if (Number.isNaN(created)) return 0
  const diff = Date.now() - created
  return Math.max(0, Math.floor(diff / 86_400_000))
}
