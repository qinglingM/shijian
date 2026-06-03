import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, KeyRound, LogOut, Shield, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isRegisteredUser } from '@/features/auth/useRequireLogin'

export function MeSettingsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const setSession = useAuthStore((s) => s.setSession)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  useAndroidBackDismiss(showLogoutConfirm, () => setShowLogoutConfirm(false))
  useAndroidBackDismiss(showDeleteConfirm, () => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(null) })

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
      localStorage.removeItem('shijian:practice-draft')
      localStorage.removeItem('shijian-rq-cache')
      localStorage.removeItem('shijian:simulated-practices')
      localStorage.removeItem('shijian:city')
      const { data: sessionData } = await sb.auth.getSession()
      if (!isRegisteredUser(sessionData.session?.user ?? null)) {
        setSession(sessionData.session)
        navigate('/map', { replace: true })
        return
      }
      setSignOutError('退出失败，请稍后重试。')
    } finally {
      setSigningOut(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null)
    if (!deletePassword.trim()) {
      setDeleteError('请输入登录密码')
      return
    }
    setDeletingAccount(true)
    try {
      const sb = getSupabase()
      const { data: session } = await sb.auth.getSession()
      if (!session?.session?.access_token) {
        setDeleteError('请先登录')
        return
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? ''
      const res = await fetch(`${baseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      const result = await res.json()
      if (!res.ok) {
        setDeleteError(result.error ?? '注销失败，请稍后重试')
        return
      }

      localStorage.clear()
      setSession(null)
      navigate('/map', { replace: true })
    } catch (err) {
      console.error('[shijian] delete account:', err)
      setDeleteError('注销失败，请稍后重试')
    } finally {
      setDeletingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header
        className="flex shrink-0 items-center border-b border-neutral-200 bg-white px-4 pb-3"
        style={{ minHeight: 'calc(3.5625rem + var(--safe-top))', paddingTop: 'var(--safe-top)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/me')}
          className="flex min-h-[44px] min-w-[44px] -ml-1 items-center justify-center rounded-lg text-neutral-500 active:bg-neutral-100"
          aria-label="返回"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="ml-3 flex-1 truncate text-base font-medium">应用设置</h1>
      </header>

      <div className="pt-4">
        {signOutError ? (
          <p className="mx-4 rounded-xl bg-orange-50 px-3 py-2 text-[11px] leading-5 text-orange-950">
            {signOutError}
          </p>
        ) : null}

        {/* 账号安全 */}
        <section className="mx-4 rounded-2xl border border-neutral-100 overflow-hidden bg-white">
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
        </section>

        {/* 法律文档 */}
        <section className="mt-4 mx-4 rounded-2xl border border-neutral-100 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => navigate('/legal/privacy')}
            className="flex items-center gap-3 w-full px-4 py-3 active:bg-neutral-50"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
              <Shield size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5 text-neutral-900">隐私政策</p>
            </div>
            <ChevronRight size={15} className="shrink-0 text-neutral-400" />
          </button>
          <div className="h-px bg-neutral-100 mx-4" />
          <button
            type="button"
            onClick={() => navigate('/legal/terms')}
            className="flex items-center gap-3 w-full px-4 py-3 active:bg-neutral-50"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
              <FileText size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5 text-neutral-900">用户协议</p>
            </div>
            <ChevronRight size={15} className="shrink-0 text-neutral-400" />
          </button>
        </section>

        {/* 退出登录 */}
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

        {/* 注销账号 */}
        {isSupabaseConfigured && userId ? (
          <section className="mt-4 mx-4 rounded-2xl border border-neutral-100 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center w-full py-3 text-sm text-rose-600 active:bg-neutral-50"
            >
              <Trash2 size={16} className="mr-1.5" />
              注销账号
            </button>
          </section>
        ) : null}
      </div>

      {/* 退出登录确认 */}
      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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

      {/* 注销账号确认 */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-labelledby="delete-confirm-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-rose-500" />
              <p id="delete-confirm-title" className="text-base font-medium text-neutral-900">
                确认注销账号？
              </p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 mb-4">
              <p className="text-xs leading-5 text-rose-700">
                注销后，您的所有个人数据将被<strong>永久删除</strong>，包括：
              </p>
              <ul className="text-xs leading-5 text-rose-700 mt-1 ml-4 list-disc">
                <li>个人资料与头像</li>
                <li>所有实践记录和菜品评价</li>
                <li>标记、投票、关注关系</li>
                <li>广场帖子与上传的图片</li>
              </ul>
              <p className="text-xs leading-5 text-rose-700 mt-2 font-medium">
                此操作<strong>不可撤销</strong>，请谨慎操作。
              </p>
            </div>
            <input
              type="password"
              placeholder="请输入登录密码确认"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleDeleteAccount() }}
            />
            {deleteError ? (
              <p className="text-xs text-rose-500 mb-2">{deleteError}</p>
            ) : null}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm text-neutral-700"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(null) }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={deletingAccount || !deletePassword.trim()}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                onClick={() => void handleDeleteAccount()}
              >
                {deletingAccount ? '注销中…' : '确认注销'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
