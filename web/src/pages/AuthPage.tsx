import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { normalizeChinaMobileToE164 } from '@/lib/phoneE164'
import {
  PASSWORD_RULE_HINT,
  passwordEndsWithPhoneTail,
  validatePasswordForAccount,
} from '@/lib/passwordPolicy'
import { EmailAuthPanel } from '@/features/auth/EmailAuthPanel'
import { callAliyunSmsOtp } from '@/features/auth/aliyunSmsOtp'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type Phase = 'login' | 'forgot'
type LoginMode = 'password' | 'otp'
type OtpPurpose = 'login' | 'forgot'
// step 1 = 手机号 + 验证码（单屏），step 2 = 设置新密码
type ForgotStep = 1 | 2

const EMAIL_AUTH = import.meta.env.VITE_ENABLE_EMAIL_AUTH === 'true'

export function AuthPage() {
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const redirectParam = params.get('redirect') || '/me'
  const safeRedirect = useMemo(() => {
    try {
      const url = new URL(redirectParam, window.location.origin)
      if (url.origin !== window.location.origin) return '/me'
      return redirectParam
    } catch {
      return '/me'
    }
  }, [redirectParam])

  const [surface, setSurface] = useState<'phone' | 'email'>(() =>
    EMAIL_AUTH && params.get('channel') === 'email' ? 'email' : 'phone',
  )
  const [phase, setPhase] = useState<Phase>('login')
  const [forgotStep, setForgotStep] = useState<ForgotStep>(1)

  const [mobileInput, setMobileInput] = useState('')
  const [e164Locked, setE164Locked] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpToken, setOtpToken] = useState<string | null>(null)
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose | null>(null)

  const [loginPw, setLoginPw] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [loginMode, setLoginMode] = useState<LoginMode>('password')

  const [forgotPw1, setForgotPw1] = useState('')
  const [forgotPw2, setForgotPw2] = useState('')
  const [showForgotPw, setShowForgotPw] = useState(false)

  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const [resendSeconds, setResendSeconds] = useState(0)
  // sendingOtp: OTP 发送中（控制内联按钮）；submitting: 主表单提交中
  const [sendingOtp, setSendingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const channelParams = params.get('channel')
  const authMode = params.get('mode')

  useEffect(() => {
    const m = params.get('mode')
    if (m === 'forgot') {
      startTransition(() => {
        setSurface('phone')
        setPhase('forgot')
        setForgotStep(1)
        resetOtp()
        setMsg(null)
      })
    }
  }, [params])

  useEffect(() => {
    startTransition(() => {
      if (EMAIL_AUTH && channelParams === 'email') setSurface('email')
      if (!EMAIL_AUTH) setSurface('phone')
    })
  }, [channelParams])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (!user) return

    const isAnonymousUser = (user as { is_anonymous?: boolean }).is_anonymous === true
    if (authMode === 'forgot' && isAnonymousUser) {
      void getSupabase().auth.signOut({ scope: 'local' })
      return
    }

    // 已登录用户可以进入忘记密码流程来设置/重置密码
    if (authMode === 'forgot') return

    navigate(safeRedirect, { replace: true })
  }, [user, navigate, safeRedirect, authMode])

  useEffect(() => {
    if (resendSeconds <= 0) return
    const t = window.setTimeout(() => setResendSeconds((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendSeconds])

  function resetOtp() {
    setOtp('')
    setE164Locked(null)
    setOtpToken(null)
    setOtpPurpose(null)
    setResendSeconds(0)
  }

  /** 手机号变化时，若已发过验证码则重置 OTP 状态 */
  function handlePhoneChange(v: string) {
    setMobileInput(v)
    if (otpToken) resetOtp()
  }

  function goPhoneLogin() {
    setPhase('login')
    setForgotStep(1)
    resetOtp()
    setMsg(null)
    setLoginPw('')
  }

  function goPhoneForgot() {
    setPhase('forgot')
    setForgotStep(1)
    resetOtp()
    setMsg(null)
    setForgotPw1('')
    setForgotPw2('')
  }

  async function sendOtp(purpose: OtpPurpose) {
    setMsg(null)
    const e164 = normalizeChinaMobileToE164(mobileInput)
    if (!e164) {
      setMsg('请输入中国大陆 11 位手机号')
      return
    }
    setSendingOtp(true)
    try {
      // 15 秒客户端超时，避免 Edge Function / 阿里云 API 挂起时按钮永久卡住
      const result = await Promise.race([
        callAliyunSmsOtp({ action: 'send', phone: e164, purpose }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('请求超时，请稍后再试')), 15_000),
        ),
      ])
      if (!result.ok || !result.token) {
        setMsg(trOtpSend(result.error ?? '验证码发送失败', purpose))
        return
      }
      setE164Locked(e164)
      setOtpToken(result.token)
      setOtp('')
      setOtpPurpose(purpose)
      setResendSeconds(60)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '发送失败，请稍后再试')
    } finally {
      setSendingOtp(false)
    }
  }

  // 找回密码：验证 OTP 后进入设置新密码步骤
  async function verifyOtpAdvance() {
    setMsg(null)
    if (!e164Locked || !otpToken || otpPurpose !== 'forgot') {
      setMsg('请先获取短信验证码')
      return
    }
    const token = otp.replace(/\D/g, '')
    if (token.length < 6) {
      setMsg('请输入 6 位短信验证码')
      return
    }
    setSubmitting(true)
    const result = await callAliyunSmsOtp({
      action: 'verify',
      phone: e164Locked,
      code: token,
      token: otpToken,
    })
    if (!result.ok) {
      setSubmitting(false)
      setMsg(trVerify(result.error ?? '验证码校验失败'))
    } else {
      setSubmitting(false)
      setForgotStep(2)
    }
  }

  async function submitLoginOtp(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!e164Locked || !otpToken || otpPurpose !== 'login') {
      setMsg('请先获取短信验证码')
      return
    }
    const code = otp.replace(/\D/g, '')
    if (code.length !== 6) {
      setMsg('请输入 6 位短信验证码')
      return
    }
    setSubmitting(true)
    setMsg('正在校验短信验证码…')
    try {
      const result = await callAliyunSmsOtp({
        action: 'complete-login',
        phone: e164Locked,
        code,
        token: otpToken,
      })
      if (!result.ok) {
        setSubmitting(false)
        setMsg(trVerify(result.error ?? '验证码登录失败'))
        return
      }

      setMsg('验证码通过，正在登录…')
      const { error } = result.access_token && result.refresh_token
        ? await setVerifiedSession(result.access_token, result.refresh_token)
        : result.temp_password
          ? await signInWithPhonePassword([
              result.login_phone,
              e164Locked,
              e164Locked.startsWith('+86') ? e164Locked.slice(3) : null,
            ], result.temp_password)
          : { error: '验证码登录失败' }
      setSubmitting(false)
      if (error) setMsg(loginUnifiedError(error))
      else navigate(safeRedirect, { replace: true })
    } catch (err) {
      setSubmitting(false)
      setMsg(err instanceof Error ? err.message : '验证码登录失败，请稍后再试')
    }
  }

  async function submitForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const errPw = validatePasswordForAccount(forgotPw1)
    if (errPw) {
      setMsg(errPw)
      return
    }
    if (forgotPw1 !== forgotPw2) {
      setMsg('两次输入的密码不一致')
      return
    }
    const national = mobileInput.replace(/\D/g, '')
    if (passwordEndsWithPhoneTail(forgotPw1, national)) {
      setMsg('密码请勿与手机号后 6 位相同')
      return
    }
    await applyPassword(forgotPw1)
  }

  async function applyPassword(newPassword: string) {
    if (!e164Locked || !otpToken) {
      setMsg('请先完成短信验证码校验')
      return
    }
    const code = otp.replace(/\D/g, '')
    if (code.length !== 6) {
      setMsg('验证码状态已失效，请重新获取')
      return
    }
    setSubmitting(true)
    const result = await callAliyunSmsOtp({
      action: 'complete-forgot',
      phone: e164Locked,
      code,
      token: otpToken,
      password: newPassword,
    })
    if (!result.ok) {
      setSubmitting(false)
      setMsg(trVerify(result.error ?? '账号处理失败'))
      return
    }

    const { error } = result.access_token && result.refresh_token
      ? await setVerifiedSession(result.access_token, result.refresh_token)
      : await signInWithPhonePassword([e164Locked], newPassword)
    setSubmitting(false)
    if (error) setMsg(loginUnifiedError(error))
    else navigate(safeRedirect, { replace: true })
  }

  async function submitLoginPhone(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const e164 = normalizeChinaMobileToE164(mobileInput)
    if (!e164) {
      setMsg('请输入中国大陆 11 位手机号')
      return
    }
    setSubmitting(true)
    const result = await callAliyunSmsOtp({
      action: 'password-login',
      phone: e164,
      password: loginPw,
    })
    setSubmitting(false)
    if (!result.ok || !result.access_token || !result.refresh_token) {
      setMsg(loginUnifiedError(result.error ?? '手机号或密码错误'))
      return
    }

    const { error } = await setVerifiedSession(result.access_token, result.refresh_token)
    if (error) setMsg(loginUnifiedError(error))
    else navigate(safeRedirect, { replace: true })
  }

  async function signInWithPhonePassword(
    phones: Array<string | null | undefined>,
    password: string,
  ): Promise<{ error: string | null }> {
    const candidates = [...new Set(phones.filter((phone): phone is string => Boolean(phone)))]
    let lastError: string | null = null
    for (const phone of candidates) {
      const { data, error } = await getSupabase().auth.signInWithPassword({ phone, password })
      if (!error) {
        setSession(data.session)
        return { error: null }
      }
      lastError = error.message
    }
    return { error: lastError ?? '登录失败' }
  }

  async function setVerifiedSession(
    accessToken: string,
    refreshToken: string,
  ): Promise<{ error: string | null }> {
    const { data, error } = await getSupabase().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) return { error: error.message }
    setSession(data.session)
    return { error: null }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <p className="text-sm leading-7 text-neutral-600">
            当前未配置 Supabase，无法登录。请在{' '}
            <code className="rounded bg-neutral-100 px-1 text-xs">web/.env.local</code>{' '}
            填写 URL 与 Anon Key 后重启。
          </p>
          <Link to="/" className="mt-8 block text-center text-sm font-medium text-orange-600 hover:text-orange-500">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md lg:max-w-3xl flex-col bg-white px-6 pb-12 pt-[max(var(--app-safe-area-inset-top),2rem)] sm:pt-[max(var(--app-safe-area-inset-top),4rem)]">
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => {
            const redirect = params.get('redirect')
            const mode = params.get('mode')
            if (mode === 'forgot' && redirect) {
              navigate(redirect, { replace: true })
            } else {
              navigate(-1)
            }
          }}
          className="absolute -left-3 -top-2 p-2 text-neutral-400 transition-colors hover:text-neutral-800"
          aria-label="关闭"
        >
          <ChevronLeft size={28} />
        </button>
        <header className="mb-10 pt-10 text-center">
          <h1 className="text-[28px] font-bold tracking-tight text-neutral-900">{headerTitle(phase, authMode)}</h1>
          <p className="mt-2 text-[15px] text-neutral-500">{subtitle(surface, phase, authMode)}</p>
        </header>

        {EMAIL_AUTH && (
          <div className="mb-8 flex gap-1.5 rounded-2xl bg-neutral-100/80 p-1.5 text-sm">
            <button
              type="button"
              className={cn(
                'flex-1 rounded-xl py-2.5 font-medium transition-all duration-200',
                surface === 'phone' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
              )}
              onClick={() => {
                setSurface('phone')
                goPhoneLogin()
                setMsg(null)
              }}
            >
              手机号账号
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded-xl py-2.5 font-medium transition-all duration-200',
                surface === 'email' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
              )}
              onClick={() => {
                setSurface('email')
                setPhase('login')
                resetOtp()
                setMsg(null)
              }}
            >
              研发邮箱
            </button>
          </div>
        )}

        <div className="relative">
          {EMAIL_AUTH && surface === 'email' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <EmailAuthPanel safeRedirect={safeRedirect} />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ── 登录：密码模式 ── */}
            {surface === 'phone' && phase === 'login' && loginMode === 'password' && (
              <motion.div
                key="login-password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <form className="space-y-6" onSubmit={submitLoginPhone}>
                  <div className="space-y-5">
                    <PhoneRow editable value={mobileInput} onChange={setMobileInput} />
                    <PasswordField
                      id="lw"
                      label="密码"
                      value={loginPw}
                      onChange={setLoginPw}
                      autocomplete="current-password"
                      reveal={showLoginPw}
                      onReveal={() => setShowLoginPw((v) => !v)}
                    />
                  </div>

                  {/* UI & UX Consistency: Left: Switch Mode, Right: Forgot */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => { setLoginMode('otp'); resetOtp(); setMsg(null) }}
                      className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
                    >
                      验证码登录
                    </button>
                    <button
                      type="button"
                      onClick={() => goPhoneForgot()}
                      className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
                    >
                      忘记密码？
                    </button>
                  </div>

                  <div className="space-y-5 pt-2">
                    {msg ? <Alert>{msg}</Alert> : null}
                    <button
                      type="submit"
                      disabled={submitting || !agreedToTerms}
                      className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? '登录中…' : '登录'}
                    </button>
                    <TermsCheckbox agreed={agreedToTerms} onChange={setAgreedToTerms} />
                  </div>
                </form>
              </motion.div>
            )}

            {/* ── 登录：验证码模式 ── */}
            {surface === 'phone' && phase === 'login' && loginMode === 'otp' && (
              <motion.div
                key="login-otp"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <form className="space-y-6" onSubmit={submitLoginOtp}>
                  <div className="space-y-5">
                    <PhoneRowWithOtp
                      value={mobileInput}
                      onChange={handlePhoneChange}
                      sendingOtp={sendingOtp}
                      resendSeconds={resendSeconds}
                      onSendOtp={() => void sendOtp('login')}
                      mainSubmitting={submitting}
                    />
                    <OtpField value={otp} onChange={setOtp} disabled={!otpToken} />
                  </div>

                  {/* UI & UX Consistency: Left: Switch Mode, Right: Info/Other */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => { setLoginMode('password'); setMsg(null) }}
                      className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
                    >
                      密码登录
                    </button>
                  </div>

                  <div className="space-y-5 pt-2">
                    {msg ? <Alert>{msg}</Alert> : null}
                    <button
                      type="submit"
                      disabled={submitting || sendingOtp || !agreedToTerms}
                      className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? '登录中…' : '登录'}
                    </button>
                    <TermsCheckbox agreed={agreedToTerms} onChange={setAgreedToTerms} />
                  </div>
                </form>
              </motion.div>
            )}

            {/* ── 找回密码 step 1 ── */}
            {surface === 'phone' && phase === 'forgot' && forgotStep === 1 && (
              <motion.div
                key="forgot-step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <form
                  className="space-y-6"
                  onSubmit={(e) => { e.preventDefault(); void verifyOtpAdvance() }}
                >
                  <div className="space-y-5">
                    <PhoneRowWithOtp
                      value={mobileInput}
                      onChange={handlePhoneChange}
                      sendingOtp={sendingOtp}
                      resendSeconds={resendSeconds}
                      onSendOtp={() => void sendOtp('forgot')}
                      mainSubmitting={submitting}
                    />
                    <OtpField value={otp} onChange={setOtp} disabled={!otpToken} />
                  </div>

                  {/* Removed redundant bottom back button since we now have the top-left chevron */}

                  <div className="space-y-5 pt-2">
                    {msg ? <Alert>{msg}</Alert> : null}
                    <button
                      type="submit"
                      disabled={submitting || sendingOtp}
                      className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? '验证中…' : '下一步'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ── 找回密码 step 2 ── */}
            {surface === 'phone' && phase === 'forgot' && forgotStep === 2 && (
              <motion.div
                key="forgot-step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <form className="space-y-6" onSubmit={submitForgotPassword}>
                  <div className="rounded-2xl bg-orange-50/50 p-4">
                    <p className="text-sm text-orange-800/80">{PASSWORD_RULE_HINT}</p>
                  </div>
                  <div className="space-y-5">
                    <PasswordField
                      id="fp1"
                      label="新密码"
                      value={forgotPw1}
                      onChange={setForgotPw1}
                      autocomplete="new-password"
                      reveal={showForgotPw}
                      onReveal={() => setShowForgotPw((v) => !v)}
                    />
                    <PasswordField
                      id="fp2"
                      label="确认新密码"
                      value={forgotPw2}
                      onChange={setForgotPw2}
                      autocomplete="new-password"
                      reveal={showForgotPw}
                      onReveal={() => setShowForgotPw((v) => !v)}
                    />
                  </div>

                  <div className="space-y-5 pt-2">
                    {msg ? <Alert>{msg}</Alert> : null}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? '重置中…' : '重置密码'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function headerTitle(phase: Phase, authMode: string | null) {
  if (phase === 'login') return '登录'
  if (authMode === 'forgot') return '设置密码'
  return '找回密码'
}

function subtitle(surface: 'phone' | 'email', phase: Phase, authMode: string | null) {
  if (surface === 'email') return '研发环境可选用邮箱账号'
  if (phase === 'login') return '未注册的手机号将自动创建新账号'
  if (authMode === 'forgot') return '通过短信验证身份后设置新密码'
  return '通过短信验证码验证身份后重置密码'
}

// ── 手机号行（普通只读/可编辑，用于密码登录） ──────────────────────────────
function PhoneRow({
  editable,
  value,
  onChange,
}: {
  editable: boolean
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">手机号</p>
      <div className="group flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20">
        <span className="flex items-center justify-center pl-4 pr-3 text-sm font-medium text-neutral-500">
          +86
        </span>
        <div className="my-2 w-px self-stretch bg-neutral-200" />
        <input
          type="tel"
          inputMode="numeric"
          autoComplete={editable ? 'tel-national' : 'off'}
          disabled={!editable}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入 11 位手机号"
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm outline-none placeholder:text-neutral-400 disabled:text-neutral-400"
        />
      </div>
    </div>
  )
}

// ── 手机号行 + 内联「获取验证码」按钮（OTP 流程专用） ──────────────────────
function PhoneRowWithOtp({
  value,
  onChange,
  sendingOtp,
  resendSeconds,
  onSendOtp,
  mainSubmitting,
}: {
  value: string
  onChange: (v: string) => void
  sendingOtp: boolean
  resendSeconds: number
  onSendOtp: () => void
  mainSubmitting: boolean
}) {
  const canSend = !sendingOtp && !mainSubmitting && resendSeconds <= 0

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">手机号</p>
      <div className="group flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20">
        <span className="flex items-center justify-center pl-4 pr-3 text-sm font-medium text-neutral-500">
          +86
        </span>
        <div className="my-2 w-px self-stretch bg-neutral-200" />
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入 11 位手机号"
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm outline-none placeholder:text-neutral-400"
        />
        <div className="pr-2">
          <button
            type="button"
            disabled={!canSend}
            onClick={onSendOtp}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
              canSend
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-neutral-200/50 hover:bg-orange-50'
                : 'text-neutral-400'
            )}
          >
            {sendingOtp ? '发送中…' : resendSeconds > 0 ? `${resendSeconds}s 后重发` : '获取验证码'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autocomplete,
  reveal,
  onReveal,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autocomplete: string
  reveal: boolean
  onReveal: () => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">{label}</p>
      <div className="group flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20">
        <input
          id={id}
          type={reveal ? 'text' : 'password'}
          autoComplete={autocomplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入密码"
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          tabIndex={-1}
          className="flex items-center justify-center pr-4 text-neutral-400 hover:text-neutral-600"
          onClick={onReveal}
        >
          {reveal ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          <span className="sr-only">{reveal ? '隐藏密码' : '显示密码'}</span>
        </button>
      </div>
    </div>
  )
}

function OtpField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <p className={cn('mb-1.5 text-sm font-medium', disabled ? 'text-neutral-400' : 'text-neutral-700')}>
        验证码
      </p>
      <div className={cn(
        'group flex items-center rounded-2xl border transition-colors',
        disabled 
          ? 'border-neutral-200 bg-neutral-50/50' 
          : 'border-neutral-200 bg-neutral-50 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20'
      )}>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? '请先获取验证码' : '请输入 6 位验证码'}
          className={cn(
            'min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base outline-none transition-all placeholder:text-sm placeholder:tracking-normal',
            disabled ? 'text-neutral-400 placeholder:text-neutral-300' : 'tracking-[0.5em] text-neutral-900'
          )}
        />
      </div>
    </div>
  )
}


function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-orange-50 px-4 py-2.5 text-[13px] text-orange-900 shadow-sm shadow-orange-500/5">{children}</p>
  )
}

function TermsCheckbox({ agreed, onChange }: { agreed: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-center gap-2 px-2 pt-2 text-center">
      <div className="flex h-5 items-center">
        <input
          id="terms-checkbox"
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500/30"
        />
      </div>
      <label htmlFor="terms-checkbox" className="text-[13px] text-neutral-500 leading-tight select-none">
        已阅读并同意我们的{' '}
        <Link
          to="/legal/privacy"
          onClick={(e) => e.stopPropagation()}
          className="text-neutral-900 font-medium transition-colors hover:text-orange-600"
        >
          隐私政策
        </Link>
        {' '}和{' '}
        <Link
          to="/legal/terms"
          onClick={(e) => e.stopPropagation()}
          className="text-neutral-900 font-medium transition-colors hover:text-orange-600"
        >
          用户协议
        </Link>
      </label>
    </div>
  )
}

function loginUnifiedError(message: string) {
  const m = message.toLowerCase()
  if (/ban|suspend|block|locked|too many/i.test(m)) return '账号异常或尝试次数过多，请稍后再试'
  return '手机号或密码错误'
}

function trOtpSend(message: string, _purpose: OtpPurpose) {
  const m = message.toLowerCase()
  if (/rate|limit|429|too many/i.test(m)) return '请求过于频繁，请稍后再试'
  if (/sms|phone|provider|not enabled|aliyun|未配置/i.test(m))
    return '短信服务不可用，请检查阿里云短信与 Edge Function 环境变量'
  return message
}

function trVerify(message: string) {
  const m = message.toLowerCase()
  if (/otp|token|code|expire|invalid/i.test(m)) return '验证码无效或已过期，请重试或重新获取'
  return message
}
