import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { validatePasswordForAccount } from '@/lib/passwordPolicy'
import { AUTH_LAX_DEV, tryLaxDevRedirect } from '@/lib/laxDevAuth'
import { getSupabase } from '@/lib/supabase'

type Phase = 'login' | 'signup' | 'forgot'

export function EmailAuthPanel({ safeRedirect }: { safeRedirect: string }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (AUTH_LAX_DEV && (await tryLaxDevRedirect(navigate, safeRedirect))) return
    setSubmitting(true)
    const sb = getSupabase()
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setSubmitting(false)
    if (error) setMsg('邮箱或密码错误')
    else navigate(safeRedirect, { replace: true })
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (AUTH_LAX_DEV && (await tryLaxDevRedirect(navigate, safeRedirect))) return
    const err = validatePasswordForAccount(password)
    if (err) {
      setMsg(err)
      return
    }
    setSubmitting(true)
    const sb = getSupabase()
    const { error, data } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nickname: nickname.trim() || undefined } },
    })
    setSubmitting(false)
    if (error) {
      setMsg(tr(error.message))
      return
    }
    if (data.session) navigate(safeRedirect, { replace: true })
    else setMsg('若开启邮箱验证，请到邮箱确认后再登录。')
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (AUTH_LAX_DEV && (await tryLaxDevRedirect(navigate, safeRedirect))) return
    if (!email.trim()) {
      setMsg('请填写邮箱')
      return
    }
    setSubmitting(true)
    const sb = getSupabase()
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?channel=email`,
    })
    setSubmitting(false)
    if (error) setMsg(tr(error.message))
    else setMsg('若邮箱已注册，将收到重置链接。')
  }

  return (
    <>
      {phase !== 'forgot' && (
        <div className="mb-6 flex gap-2 rounded-2xl bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            className={cn(
              'flex-1 rounded-xl py-2 font-medium transition-colors',
              phase === 'login' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
            )}
            onClick={() => {
              setPhase('login')
              setMsg(null)
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-xl py-2 font-medium transition-colors',
              phase === 'signup' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
            )}
            onClick={() => {
              setPhase('signup')
              setMsg(null)
            }}
          >
            注册
          </button>
        </div>
      )}

      {phase === 'login' && (
        <>
          <button
            type="button"
            className="mb-4 text-xs text-orange-700 underline underline-offset-2"
            onClick={() => setPhase('forgot')}
          >
            忘记密码？
          </button>
          <form className="space-y-4" onSubmit={login}>
            <label className="block text-xs font-medium text-neutral-600">
              邮箱
              <input
                type="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              密码
              <input
                type="password"
                required
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
              />
            </label>
            <p className="text-[11px] leading-5 text-neutral-500">
              仅限研发环境；预留邮箱详见迁移{' '}
              <code className="rounded bg-neutral-100 px-0.5">0010</code>。
              <Link to="/legal/terms" className="ml-1 text-orange-700 underline">
                《用户协议》
              </Link>
            </p>
            {msg && (
              <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">{msg}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>
        </>
      )}

      {phase === 'signup' && (
        <form className="space-y-4" onSubmit={signup}>
          <label className="block text-xs font-medium text-neutral-600">
            昵称（可选）
            <input
              maxLength={32}
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            密码（8–20 位字母+数字）
            <input
              type="password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
            />
          </label>
          {msg && (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">{msg}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-[#ff4d00] to-[#ff1f6d] py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '提交中…' : '注册'}
          </button>
        </form>
      )}

      {phase === 'forgot' && (
        <form className="space-y-4" onSubmit={forgot}>
          <button type="button" className="text-xs text-neutral-500" onClick={() => setPhase('login')}>
            ← 返回登录
          </button>
          <label className="block text-xs font-medium text-neutral-600">
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
            />
          </label>
          {msg && (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">{msg}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? '发送中…' : '发送重置邮件'}
          </button>
        </form>
      )}
    </>
  )
}

function tr(message: string) {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/user already registered|already registered/i.test(message)) return '该邮箱已注册，请登录'
  if (/signup.*disabled/i.test(message)) return '站内注册已关闭'
  return message
}
