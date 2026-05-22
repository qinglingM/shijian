import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeChinaMobileToE164 } from '@/lib/phoneE164'
import {
  PASSWORD_RULE_HINT,
  passwordEndsWithPhoneTail,
  validatePasswordForAccount,
} from '@/lib/passwordPolicy'
import { EmailAuthPanel } from '@/features/auth/EmailAuthPanel'
import { callAliyunSmsOtp } from '@/features/auth/aliyunSmsOtp'
import { AUTH_LAX_DEV, tryLaxDevRedirect } from '@/lib/laxDevAuth'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type Phase = 'login' | 'signup' | 'forgot'
type LoginMode = 'password' | 'otp'
type LoginOtpStep = 1 | 2
type OtpPurpose = 'login' | 'signup' | 'forgot'
type SignupStep = 1 | 2 | 3
type ForgotStep = 1 | 2 | 3

const EMAIL_AUTH = import.meta.env.VITE_ENABLE_EMAIL_AUTH === 'true'

export function AuthPage() {
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const redirectParam = params.get('redirect') || '/me'
  const safeRedirect = useMemo(() => {
    if (redirectParam.startsWith('/') && !redirectParam.startsWith('//'))
      return redirectParam
    return '/me'
  }, [redirectParam])

  const [surface, setSurface] = useState<'phone' | 'email'>(() =>
    EMAIL_AUTH && params.get('channel') === 'email' ? 'email' : 'phone',
  )
  const [phase, setPhase] = useState<Phase>('login')
  const [signupStep, setSignupStep] = useState<SignupStep>(1)
  const [forgotStep, setForgotStep] = useState<ForgotStep>(1)

  const [mobileInput, setMobileInput] = useState('')
  const [e164Locked, setE164Locked] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpToken, setOtpToken] = useState<string | null>(null)
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose | null>(null)

  const [loginPw, setLoginPw] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [loginOtpStep, setLoginOtpStep] = useState<LoginOtpStep>(1)

  const [regPw1, setRegPw1] = useState('')
  const [regPw2, setRegPw2] = useState('')
  const [showRegPw, setShowRegPw] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [regNickname, setRegNickname] = useState('')

  const [forgotPw1, setForgotPw1] = useState('')
  const [forgotPw2, setForgotPw2] = useState('')
  const [showForgotPw, setShowForgotPw] = useState(false)

  const [resendSeconds, setResendSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const channelParams = params.get('channel')
  const authMode = params.get('mode')

  useEffect(() => {
    const m = params.get('mode')
    if (m === 'signup') {
      startTransition(() => {
        setSurface('phone')
        setPhase('signup')
        setSignupStep(1)
        resetOtp()
        setMsg(null)
      })
      return
    }
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
    if ((authMode === 'signup' || authMode === 'forgot') && isAnonymousUser) {
      void getSupabase().auth.signOut({ scope: 'local' })
      return
    }

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

  function goPhoneLogin() {
    setPhase('login')
    setLoginOtpStep(1)
    setSignupStep(1)
    setForgotStep(1)
    resetOtp()
    setMsg(null)
    setLoginPw('')
  }

  function goPhoneSignup() {
    setPhase('signup')
    setSignupStep(1)
    resetOtp()
    setMsg(null)
    setRegPw1('')
    setRegPw2('')
    setAgreedTerms(false)
    setRegNickname('')
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
    setSubmitting(true)
    const result = await callAliyunSmsOtp({ action: 'send', phone: e164, purpose })
    setSubmitting(false)
    if (!result.ok || !result.token) {
      setMsg(trOtpSend(result.error ?? '验证码发送失败', purpose))
      return
    }
    setE164Locked(e164)
    setOtpToken(result.token)
    setOtp('')
    setOtpPurpose(purpose)
    setResendSeconds(60)
    if (purpose === 'login') setLoginOtpStep(2)
    else if (purpose === 'signup') setSignupStep(2)
    else setForgotStep(2)
  }

  async function verifyOtpAdvance(purposeExpected: 'signup' | 'forgot') {
    setMsg(null)
    if (!e164Locked || !otpToken || otpPurpose !== purposeExpected) {
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
    setSubmitting(false)
    if (!result.ok) setMsg(trVerify(result.error ?? '验证码校验失败'))
    else if (purposeExpected === 'signup') setSignupStep(3)
    else setForgotStep(3)
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

  async function submitRegisterPassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const errPw = validatePasswordForAccount(regPw1)
    if (errPw) {
      setMsg(errPw)
      return
    }
    if (regPw1 !== regPw2) {
      setMsg('两次输入的密码不一致')
      return
    }
    const national = mobileInput.replace(/\D/g, '')
    if (passwordEndsWithPhoneTail(regPw1, national)) {
      setMsg('密码请勿与手机号后 6 位相同')
      return
    }
    if (!agreedTerms) {
      setMsg('请先阅读并同意用户协议和隐私政策')
      return
    }
    await applyPassword(regPw1, regNickname.trim() || undefined)
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

  async function applyPassword(newPassword: string, nicknameOpt?: string) {
    if (!e164Locked || !otpToken || !otpPurpose) {
      setMsg('请先完成短信验证码校验')
      return
    }
    const code = otp.replace(/\D/g, '')
    if (code.length !== 6) {
      setMsg('验证码状态已失效，请重新获取')
      return
    }
    setSubmitting(true)
    const result = await callAliyunSmsOtp(
      otpPurpose === 'signup'
        ? {
            action: 'complete-signup',
            phone: e164Locked,
            code,
            token: otpToken,
            password: newPassword,
            nickname: nicknameOpt,
          }
        : {
            action: 'complete-forgot',
            phone: e164Locked,
            code,
            token: otpToken,
            password: newPassword,
          },
    )
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
    if (AUTH_LAX_DEV && (await tryLaxDevRedirect(navigate, safeRedirect))) return
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
      <div className="mx-auto flex min-h-full max-w-md flex-col bg-white px-6 py-14">
        <p className="text-sm leading-7 text-neutral-600">
          当前未配置 Supabase，无法登录。请在{' '}
          <code className="rounded bg-neutral-100 px-1 text-xs">web/.env.local</code>{' '}
          填写 URL 与 Anon Key 后重启。
        </p>
        <Link to="/" className="mt-8 text-center text-sm font-medium text-orange-600">
          返回首页
        </Link>
      </div>
    )
  }

  const displayMobile =
    e164Locked && e164Locked.startsWith('+86') && e164Locked.length === 14
      ? e164Locked.slice(3)
      : e164Locked ?? mobileInput

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-gradient-to-b from-white via-orange-50/30 to-white px-6 pb-14 pt-8">
      <header className="mb-7">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1)
            } else {
              navigate('/tier-map', { replace: true })
            }
          }}
          className="flex items-center gap-1 text-sm text-neutral-500"
        >
          <span aria-hidden="true">←</span> 返回
        </button>
        <h1 className="mt-5 text-[26px] font-semibold text-neutral-950">{headerTitle(phase)}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">{subtitle(surface, phase)}</p>
        {AUTH_LAX_DEV && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
            开发放行（本地 npm run dev 默认开启）：先尝试配置的{' '}
            <code className="rounded bg-white/70 px-0.5">VITE_FIXTURE_*</code>，再用匿名登录；任意表单提交也会走同一逻辑。
            若不想用：在{' '}
            <code className="rounded bg-white/70 px-0.5">.env.local</code>{' '}
            设 <code className="rounded bg-white/70 px-0.5">VITE_AUTH_LAX_DEV=false</code>。
            <span className="font-semibold">线上构建不会启用。</span>
          </p>
        )}
      </header>

      {EMAIL_AUTH && (
        <div className="mb-6 flex gap-2 rounded-2xl bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            className={cn(
              'flex-1 rounded-xl py-2 font-medium transition-colors',
              surface === 'phone' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
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
              'flex-1 rounded-xl py-2 font-medium transition-colors',
              surface === 'email' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
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

      {EMAIL_AUTH && surface === 'email' && <EmailAuthPanel safeRedirect={safeRedirect} />}

      {surface === 'phone' && phase === 'login' && (
        <div className="space-y-4">
          {loginMode === 'password' ? (
            <form className="space-y-4" onSubmit={submitLoginPhone}>
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
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setLoginMode('otp'); setLoginOtpStep(1); resetOtp(); setMsg(null) }}
                  className="text-xs text-orange-700 underline underline-offset-2"
                >
                  用验证码登录
                </button>
                <button
                  type="button"
                  onClick={() => goPhoneForgot()}
                  className="text-xs text-orange-700 underline underline-offset-2"
                >
                  忘记密码？
                </button>
              </div>
              {msg ? <Alert>{msg}</Alert> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {submitting ? '登录中…' : '登录'}
              </button>
            </form>
          ) : loginOtpStep === 1 ? (
            <div className="space-y-4">
              <PhoneRow editable value={mobileInput} onChange={setMobileInput} />
              <button
                type="button"
                disabled={submitting}
                onClick={() => void sendOtp('login')}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {submitting ? '发送中…' : '发送验证码'}
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setMsg(null) }}
                className="flex items-center gap-1 text-xs text-neutral-500"
              >
                <span aria-hidden="true">←</span> 使用密码登录
              </button>
              <SmsFootnote />
              {msg ? <Alert>{msg}</Alert> : null}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submitLoginOtp}>
              <PhoneRow editable={false} value={displayMobile} onChange={() => {}} />
              <OtpField value={otp} onChange={setOtp} />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {submitting ? '登录中…' : '登录'}
              </button>
              <Resend
                loading={submitting}
                secs={resendSeconds}
                onResend={() => void sendOtp('login')}
              />
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-neutral-500"
                onClick={() => { setLoginOtpStep(1); resetOtp(); setMsg(null) }}
              >
                <span aria-hidden="true">←</span> 修改手机号
              </button>
              {msg ? <Alert>{msg}</Alert> : null}
            </form>
          )}

          <div className="pt-2 text-center">
            <p className="text-sm text-neutral-500">
              还没有账号？
              <button
                type="button"
                className="ml-1 font-semibold text-orange-700 underline-offset-4 hover:underline"
                onClick={() => goPhoneSignup()}
              >
                注册
              </button>
            </p>
          </div>
        </div>
      )}

      {surface === 'phone' && phase === 'signup' && signupStep === 1 && (
        <div className="space-y-4">
          <PhoneRow editable value={mobileInput} onChange={setMobileInput} />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void sendOtp('signup')}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '发送中…' : '发送验证码'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-neutral-500"
            onClick={() => goPhoneLogin()}
          >
            <span aria-hidden="true">←</span> 已有账号？去登录
          </button>
          <SmsFootnote />
          {msg ? <Alert>{msg}</Alert> : null}
        </div>
      )}

      {surface === 'phone' && phase === 'signup' && signupStep === 2 && (
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          void verifyOtpAdvance('signup')
        }}
        >
          <PhoneRow editable={false} value={displayMobile} onChange={() => {}} />
          <OtpField value={otp} onChange={setOtp} />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '验证中…' : '验证'}
          </button>
          <Resend
            loading={submitting}
            secs={resendSeconds}
            onResend={() => void sendOtp('signup')}
          />
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-neutral-500"
            onClick={() => { setSignupStep(1); resetOtp(); setMsg(null) }}
          >
            <span aria-hidden="true">←</span> 修改手机号
          </button>
          {msg ? <Alert>{msg}</Alert> : null}
        </form>
      )}

      {surface === 'phone' && phase === 'signup' && signupStep === 3 && (
        <form className="space-y-4" onSubmit={submitRegisterPassword}>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">{PASSWORD_RULE_HINT}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">昵称（可选）</label>
            <input
              maxLength={32}
              value={regNickname}
              onChange={(e) => setRegNickname(e.target.value)}
              placeholder="输入昵称"
              className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
            />
          </div>
          <PasswordField
            id="rp1"
            label="设置密码"
            value={regPw1}
            onChange={setRegPw1}
            autocomplete="new-password"
            reveal={showRegPw}
            onReveal={() => setShowRegPw((v) => !v)}
          />
          <PasswordField
            id="rp2"
            label="确认密码"
            value={regPw2}
            onChange={setRegPw2}
            autocomplete="new-password"
            reveal={showRegPw}
            onReveal={() => setShowRegPw((v) => !v)}
          />
          <TermsBox checked={agreedTerms} onChange={setAgreedTerms} />
          {msg ? <Alert>{msg}</Alert> : null}
          <button
            type="submit"
            disabled={submitting || !agreedTerms}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>
      )}

      {surface === 'phone' && phase === 'forgot' && forgotStep === 1 && (
        <div className="space-y-4">
          <PhoneRow editable value={mobileInput} onChange={setMobileInput} />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void sendOtp('forgot')}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '发送中…' : '发送验证码'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-neutral-500"
            onClick={() => goPhoneLogin()}
          >
            <span aria-hidden="true">←</span> 返回登录
          </button>
          <SmsFootnote />
          {msg ? <Alert>{msg}</Alert> : null}
        </div>
      )}

      {surface === 'phone' && phase === 'forgot' && forgotStep === 2 && (
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          void verifyOtpAdvance('forgot')
        }}
        >
          <PhoneRow editable={false} value={displayMobile} onChange={() => {}} />
          <OtpField value={otp} onChange={setOtp} />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '验证中…' : '验证'}
          </button>
          <Resend
            loading={submitting}
            secs={resendSeconds}
            onResend={() => void sendOtp('forgot')}
          />
          <button type="button" className="flex items-center gap-1 text-xs text-neutral-500" onClick={() => goPhoneLogin()}>
            <span aria-hidden="true">←</span> 返回登录
          </button>
          {msg ? <Alert>{msg}</Alert> : null}
        </form>
      )}

      {surface === 'phone' && phase === 'forgot' && forgotStep === 3 && (
        <form className="space-y-4" onSubmit={submitForgotPassword}>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">{PASSWORD_RULE_HINT}</p>
          </div>
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
          {msg ? <Alert>{msg}</Alert> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? '重置中…' : '重置密码'}
          </button>
        </form>
      )}

    </div>
  )
}

function headerTitle(phase: Phase) {
  if (phase === 'login') return '登录'
  if (phase === 'signup') return '注册账号'
  return '找回密码'
}

function subtitle(surface: 'phone' | 'email', phase: Phase) {
  if (surface === 'email') return '研发环境可选用邮箱账号'
  if (phase === 'login') return ''
  if (phase === 'signup') return '验证手机号后设置密码，快速完成注册'
  return '通过短信验证码验证身份后重置密码'
}

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
      <p className="text-xs font-medium text-neutral-600">手机号</p>
      <div className="mt-1.5 flex gap-2">
        <span className="flex w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 text-sm text-neutral-600">
          +86
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete={editable ? 'tel-national' : 'off'}
          disabled={!editable}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="11 位手机号"
          className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 placeholder:text-neutral-400 focus:border-orange-400 focus:ring disabled:bg-neutral-50"
        />
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
    <label className="block text-xs font-medium text-neutral-600">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <button type="button" tabIndex={-1} className="text-neutral-400" onClick={onReveal}>
          {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          <span className="sr-only">{reveal ? '隐藏密码' : '显示密码'}</span>
        </button>
      </span>
      <input
        id={id}
        type={reveal ? 'text' : 'password'}
        autoComplete={autocomplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring"
      />
    </label>
  )
}

function OtpField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-600">验证码</p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入 6 位验证码"
        className="mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-3 text-base tracking-[0.5em] outline-none ring-orange-400/40 placeholder:tracking-normal focus:border-orange-400 focus:ring"
      />
    </div>
  )
}

function TermsBox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-400"
      />
      <span>
        我已阅读并同意
        <Link className="mx-1 text-orange-800 underline" to="/legal/terms">
          《用户协议》
        </Link>
        与
        <Link className="mx-1 text-orange-800 underline" to="/legal/privacy">
          《隐私政策》
        </Link>
      </span>
    </label>
  )
}

function Resend({
  loading,
  secs,
  onResend,
}: {
  loading: boolean
  secs: number
  onResend: () => void
}) {
  return (
    <button
      type="button"
      disabled={loading || secs > 0}
      onClick={() => onResend()}
      className="w-full rounded-xl border border-neutral-200 py-2.5 text-sm text-neutral-600 disabled:opacity-40"
    >
      {secs > 0 ? `${secs} 秒后可重发验证码` : '重新发送验证码'}
    </button>
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">{children}</p>
  )
}

function SmsFootnote() {
  return (
    <p className="text-[11px] leading-5 text-neutral-500">
      验证码由阿里云短信发送，5 分钟内有效
    </p>
  )
}

function loginUnifiedError(message: string) {
  const m = message.toLowerCase()
  if (/ban|suspend|block|locked|too many/i.test(m)) return '账号异常或尝试次数过多，请稍后再试'
  return '手机号或密码错误'
}

function trOtpSend(message: string, purpose: OtpPurpose) {
  const m = message.toLowerCase()
  if (/rate|limit|429|too many/i.test(m)) return '请求过于频繁，请稍后再试'
  if (/sms|phone|provider|not enabled|aliyun|未配置/i.test(m))
    return '短信服务不可用，请检查阿里云短信与 Edge Function 环境变量'
  if (purpose === 'forgot' && (/exist|found|registered|unknown/i.test(m)))
    return '无法发送验证码，请确认手机号是否正确或暂未注册（安全提示已与登录对齐）。'
  return message
}

function trVerify(message: string) {
  const m = message.toLowerCase()
  if (/otp|token|code|expire|invalid/i.test(m)) return '验证码无效或已过期，请重试或重新获取'
  return message
}
