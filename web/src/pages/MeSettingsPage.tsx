import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, KeyRound, LogOut } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function MeSettingsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const setSession = useAuthStore((s) => s.setSession)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  async function handleSignOut() {
    setSignOutError(null)
    setSigningOut(true)
    try {
      const sb = getSupabase()
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
      setSignOutError('退出失败，请稍后重试。')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <BackHeader title="登录设置" backTo="/me" />

      {signOutError ? (
        <p className="mx-4 mt-4 rounded-xl bg-orange-50 px-3 py-2 text-[11px] leading-5 text-orange-950">
          {signOutError}
        </p>
      ) : null}

      <section className="mt-4 mx-4 rounded-2xl border border-neutral-100 overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => navigate('/auth?mode=forgot&redirect=/me')}
          className="flex items-start gap-3 w-full px-4 py-3 active:bg-neutral-50"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
            <KeyRound size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5 text-neutral-900">设置密码</p>
            <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">通过手机验证码设置或重置登录密码</p>
          </div>
          <ChevronRight size={15} className="mt-1 shrink-0 text-neutral-400" />
        </button>

        <div className="border-b border-neutral-100" />

        <button
          type="button"
          onClick={() => navigate('/auth?mode=forgot&redirect=/me')}
          className="flex items-start gap-3 w-full px-4 py-3 active:bg-neutral-50"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
            <KeyRound size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5 text-neutral-900">修改密码</p>
            <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">通过手机验证码修改当前密码</p>
          </div>
          <ChevronRight size={15} className="mt-1 shrink-0 text-neutral-400" />
        </button>
      </section>

      {isSupabaseConfigured && userId ? (
        <section className="mt-4 mx-4 rounded-2xl border border-neutral-100 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className="flex items-center justify-center w-full py-3 text-sm text-rose-500 active:bg-neutral-50 disabled:opacity-50"
          >
            <LogOut size={16} className="mr-1.5" />
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
