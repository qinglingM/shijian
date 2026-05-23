import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCESS_KEY_ID = Deno.env.get('ALIYUN_ACCESS_KEY_ID') ?? ''
const ACCESS_KEY_SECRET = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') ?? ''
// Supabase secrets 对中文有编码 bug，签名名用 base64 存
const SMS_SIGN_NAME_B64 = Deno.env.get('ALIYUN_SMS_SIGN_NAME_B64') ?? ''
const SMS_SIGN_NAME = SMS_SIGN_NAME_B64
  ? new TextDecoder().decode(Uint8Array.from(atob(SMS_SIGN_NAME_B64), c => c.charCodeAt(0)))
  : (Deno.env.get('ALIYUN_SMS_SIGN_NAME') ?? '')
const SMS_TEMPLATE_CODE = Deno.env.get('ALIYUN_SMS_TEMPLATE_CODE') ?? ''
const OTP_SECRET = Deno.env.get('ALIYUN_OTP_HMAC_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

function json(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, ...headers } })
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('fly-client-ip')
    || 'unknown'
}

function consumeRateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    pruneRateBuckets(now)
    return null
  }
  if (bucket.count >= limit) return Math.ceil((bucket.resetAt - now) / 1000)
  bucket.count += 1
  return null
}

function pruneRateBuckets(now: number) {
  if (rateBuckets.size < 1000) return
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key)
  }
}

function rateLimitResponse(retryAfter: number): Response {
  return json(
    { ok: false, error: '操作过于频繁，请稍后再试' },
    429,
    { 'Retry-After': String(retryAfter) },
  )
}

function checkRateLimit(req: Request, action: string | undefined, purpose: string | undefined, phone: string): Response | null {
  const ip = clientIp(req)
  const phoneKey = phone.replace(/\D/g, '') || 'unknown-phone'
  const checks: Array<[string, number, number]> = []

  if (action === 'send') {
    checks.push([`send:phone:${purpose ?? 'unknown'}:${phoneKey}`, 3, 60 * 1000])
    checks.push([`send-hour:phone:${purpose ?? 'unknown'}:${phoneKey}`, 8, 60 * 60 * 1000])
    checks.push([`send:ip:${ip}`, 30, 60 * 60 * 1000])
  } else if (action === 'password-login') {
    checks.push([`password:phone-ip:${phoneKey}:${ip}`, 8, 15 * 60 * 1000])
    checks.push([`password:ip:${ip}`, 60, 15 * 60 * 1000])
  } else if (action === 'verify' || action === 'complete-login' || action === 'complete-signup' || action === 'complete-forgot') {
    checks.push([`otp-check:phone-ip:${phoneKey}:${ip}`, 12, 5 * 60 * 1000])
    checks.push([`otp-check:ip:${ip}`, 80, 5 * 60 * 1000])
  }

  for (const [key, limit, windowMs] of checks) {
    const retryAfter = consumeRateLimit(key, limit, windowMs)
    if (retryAfter !== null) return rateLimitResponse(retryAfter)
  }
  return null
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A')
}

async function hmacBytes(key: string, data: string, algo: 'SHA-1' | 'SHA-256'): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: algo }, false, ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))))
}

async function sendSms(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const nonce = crypto.randomUUID().replace(/-/g, '')

  const params: Record<string, string> = {
    Action: 'SendSmsVerifyCode',
    Version: '2017-05-25',
    AccessKeyId: ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: nonce,
    SignatureVersion: '1.0',
    Timestamp: timestamp,
    Format: 'JSON',
    PhoneNumber: phone,
    SignName: SMS_SIGN_NAME,
    TemplateCode: SMS_TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ code, min: '5' }),
  }

  const canonical = Object.keys(params).sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
  params.Signature = toBase64(await hmacBytes(ACCESS_KEY_SECRET + '&', stringToSign, 'SHA-1'))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetch('https://dypnsapi.aliyuncs.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: new URLSearchParams(params).toString(),
      signal: controller.signal,
    })
  } catch {
    return { ok: false, error: '短信服务请求超时或网络不通，请稍后再试' }
  } finally {
    clearTimeout(timer)
  }
  const json = await res.json() as { Code: string; Message: string }
  if (json.Code !== 'OK') return { ok: false, error: translateSmsError(json.Code, json.Message) }
  return { ok: true }
}

function translateSmsError(code: string, message: string): string {
  const map: Record<string, string> = {
    'isv.BUSINESS_LIMIT_CONTROL': '发送频率超限，请稍后再试',
    'biz.FREQUENCY': '发送频率超限，请稍后再试',
    'isv.MOBILE_NUMBER_ILLEGAL': '手机号格式不正确',
    'isv.SMS_TEMPLATE_ILLEGAL': '短信模板不存在或未审核',
    'isv.SMS_SIGNATURE_ILLEGAL': '短信签名不存在或未审核',
    'SignatureDoesNotMatch': '阿里云请求签名验证失败',
  }
  return map[code] ?? `${code}: ${message}`
}

async function makeToken(phone: string, otp: string): Promise<string> {
  const expires = Date.now() + 5 * 60 * 1000
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const payload = `${phone}:${expires}:${nonce}`
  const sig = toBase64(await hmacBytes(OTP_SECRET, `${payload}:${otp}`, 'SHA-256'))
  return `${btoa(payload)}.${sig}`
}

async function verifyToken(phone: string, code: string, token: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.')
    const payload = atob(token.slice(0, dot))
    const sig = token.slice(dot + 1)
    const [tPhone, tExp] = payload.split(':')
    if (tPhone !== phone) return false
    if (Date.now() > Number(tExp)) return false
    const expected = toBase64(await hmacBytes(OTP_SECRET, `${payload}:${code}`, 'SHA-256'))
    return sig === expected
  } catch { return false }
}

function missingConfig(needsAdmin = false): string | null {
  if (!ACCESS_KEY_ID) return 'ALIYUN_ACCESS_KEY_ID'
  if (!ACCESS_KEY_SECRET) return 'ALIYUN_ACCESS_KEY_SECRET'
  if (!SMS_SIGN_NAME) return 'ALIYUN_SMS_SIGN_NAME'
  if (!SMS_TEMPLATE_CODE) return 'ALIYUN_SMS_TEMPLATE_CODE'
  if (!OTP_SECRET) return 'ALIYUN_OTP_HMAC_SECRET'
  if (needsAdmin && !SUPABASE_URL) return 'SUPABASE_URL'
  if (needsAdmin && !SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY'
  if (needsAdmin && !SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY'
  return null
}

let adminClient: ReturnType<typeof createClient> | null = null

function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

function normalizeE164Phone(phone: string): string {
  if (phone.startsWith('+')) return phone
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+86${digits}`
  if (digits.length === 13 && digits.startsWith('86')) return `+${digits}`
  return phone
}

function samePhone(a: string | null | undefined, b: string): boolean {
  return (a ?? '').replace(/\D/g, '') === b.replace(/\D/g, '')
}

async function phoneAccountEmail(phone: string): Promise<string> {
  const normalized = normalizeE164Phone(phone)
  const digest = await sha256Hex(`phone:${normalized}`)
  return `phone-${digest.slice(0, 32)}@phone.shijian.app`
}

function randomPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return `${toBase64(bytes)}Aa1!`
}

function phoneLoginCandidates(...phones: Array<string | null | undefined>): string[] {
  const candidates: string[] = []
  const add = (phone: string | null | undefined) => {
    if (!phone) return
    const trimmed = phone.trim()
    if (!trimmed || candidates.includes(trimmed)) return
    candidates.push(trimmed)

    const digits = trimmed.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('1')) {
      add(`+86${digits}`)
      add(`86${digits}`)
    }
    if (digits.length === 13 && digits.startsWith('86')) {
      add(`+${digits}`)
      add(digits.slice(2))
    }
  }
  phones.forEach(add)
  return candidates
}

type PasswordCredential = { email: string } | { phone: string }

async function signInWithPassword(credentials: PasswordCredential[], password: string) {
  let lastError = '登录失败'
  for (const credential of credentials) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...credential, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.access_token && json?.refresh_token) return json
    lastError = json?.error_description ?? json?.msg ?? json?.message ?? lastError
  }
  throw new Error(lastError)
}

async function findUserByPhoneOrEmail(phone: string) {
  const admin = getAdminClient()
  const perPage = 1000
  const accountEmail = await phoneAccountEmail(phone)
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => samePhone(u.phone, phone) || u.email === accountEmail)
    if (found) return found
    if (data.users.length < perPage) return null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body: {
    action?: string
    phone?: string
    code?: string
    token?: string
    purpose?: 'login' | 'signup' | 'forgot'
    password?: string
    nickname?: string
  }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), { headers: CORS })
  }

  const { action, phone, code, token, purpose, password, nickname } = body
  if (!phone) return new Response(JSON.stringify({ ok: false, error: '缺少手机号' }), { headers: CORS })

  const needsAdmin =
    action === 'complete-login' ||
    action === 'complete-signup' ||
    action === 'complete-forgot' ||
    action === 'password-login' ||
    (action === 'send' && (purpose === 'login' || purpose === 'signup' || purpose === 'forgot'))
  const missing = missingConfig(needsAdmin)
  if (missing) {
    return new Response(JSON.stringify({ ok: false, error: `未配置环境变量：${missing}` }), { headers: CORS })
  }

  // dypnsapi 需要国内格式（去掉 +86 前缀）
  const e164Phone = normalizeE164Phone(phone)
  const localPhone = e164Phone.startsWith('+86') ? e164Phone.slice(3) : e164Phone
  const limited = checkRateLimit(req, action, purpose, e164Phone)
  if (limited) return limited

  if (action === 'send') {
    // 找回密码：必须已有账号；登录：新旧号均可发（新号会在 complete-login 时自动注册）
    if (purpose === 'forgot') {
      try {
        const existingUser = await findUserByPhoneOrEmail(e164Phone)
        if (!existingUser) {
          return new Response(JSON.stringify({ ok: false, error: '该手机号尚未注册' }), { headers: CORS })
        }
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false,
          error: e instanceof Error ? e.message : '查询手机号失败',
        }), { headers: CORS })
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const smsResult = await sendSms(localPhone, otp)
    if (!smsResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: smsResult.error }), { headers: CORS })
    }
    const otpToken = await makeToken(localPhone, otp)
    return new Response(JSON.stringify({ ok: true, token: otpToken }), { headers: CORS })
  }

  if (action === 'verify') {
    if (!code || !token) {
      return new Response(JSON.stringify({ ok: false, error: '缺少验证码或 token' }), { headers: CORS })
    }
    const valid = await verifyToken(localPhone, code.replace(/\D/g, ''), token)
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: '验证码错误或已过期（5分钟内有效）' }), { headers: CORS })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  if (action === 'password-login') {
    if (!password) {
      return new Response(JSON.stringify({ ok: false, error: '缺少密码' }), { headers: CORS })
    }

    const admin = getAdminClient()
    try {
      const existingUser = await findUserByPhoneOrEmail(e164Phone)
      if (!existingUser) {
        return new Response(JSON.stringify({ ok: false, error: '手机号或密码错误' }), { headers: CORS })
      }

      const accountEmail = await phoneAccountEmail(e164Phone)
      await admin.auth.admin.updateUserById(existingUser.id, {
        email: accountEmail,
        phone: e164Phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          phone_e164: e164Phone,
        },
      })
      const session = await signInWithPassword([
        { email: accountEmail },
        ...phoneLoginCandidates(existingUser.phone, e164Phone, localPhone).map((phone) => ({ phone })),
      ], password)
      return new Response(JSON.stringify({
        ok: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type,
      }), { headers: CORS })
    } catch {
      return new Response(JSON.stringify({ ok: false, error: '手机号或密码错误' }), { headers: CORS })
    }
  }

  if (action === 'complete-login' || action === 'complete-signup' || action === 'complete-forgot') {
    if (!code || !token) {
      return new Response(JSON.stringify({ ok: false, error: '缺少验证码或 token' }), { headers: CORS })
    }
    if (action !== 'complete-login' && (!password || password.length < 8)) {
      return new Response(JSON.stringify({ ok: false, error: '缺少密码或密码过短' }), { headers: CORS })
    }

    const valid = await verifyToken(localPhone, code.replace(/\D/g, ''), token)
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: '验证码错误或已过期（5分钟内有效）' }), { headers: CORS })
    }

    const admin = getAdminClient()

    try {
      const existingUser = await findUserByPhoneOrEmail(e164Phone)

      if (action === 'complete-login') {
        const accountEmail = await phoneAccountEmail(e164Phone)

        if (!existingUser) {
          // 新用户：验证码通过后自动注册
          const autoPassword = randomPassword()
          const { error } = await admin.auth.admin.createUser({
            email: accountEmail,
            phone: e164Phone,
            password: autoPassword,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: { phone_e164: e164Phone },
          })
          if (error) throw error
          const session = await signInWithPassword([{ email: accountEmail }], autoPassword)
          return new Response(JSON.stringify({
            ok: true,
            login_phone: e164Phone,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            token_type: session.token_type,
          }), { headers: CORS })
        }

        // 已有账号：magic link 登录
        const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
          email: accountEmail,
          phone: e164Phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            ...(existingUser.user_metadata ?? {}),
            phone_e164: e164Phone,
          },
        })
        if (error) throw error
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: accountEmail,
        })
        if (linkError) throw linkError
        const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token_hash: linkData.properties.hashed_token, type: 'magiclink' }),
        })
        const session = await verifyRes.json().catch(() => ({}))
        if (!verifyRes.ok || !session?.access_token) {
          throw new Error(session?.error_description ?? session?.msg ?? session?.message ?? '登录失败')
        }
        return new Response(JSON.stringify({
          ok: true,
          login_phone: existingUser.phone ?? e164Phone,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type,
        }), { headers: CORS })
      }

      if (action === 'complete-signup') {
        if (existingUser) {
          return new Response(JSON.stringify({ ok: false, error: '手机号已注册，请直接登录' }), { headers: CORS })
        }

        const accountEmail = await phoneAccountEmail(e164Phone)
        const { error } = await admin.auth.admin.createUser({
          email: accountEmail,
          phone: e164Phone,
          password,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            phone_e164: e164Phone,
            ...(nickname?.trim() ? { nickname: nickname.trim() } : {}),
          },
        })
        if (error) throw error
        const session = await signInWithPassword([{ email: accountEmail }], password)
        return new Response(JSON.stringify({
          ok: true,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type,
        }), { headers: CORS })
      }

      if (!existingUser) {
        return new Response(JSON.stringify({ ok: false, error: '该手机号尚未注册' }), { headers: CORS })
      }

      const accountEmail = await phoneAccountEmail(e164Phone)
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        email: accountEmail,
        phone: e164Phone,
        email_confirm: true,
        phone_confirm: true,
        password,
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          phone_e164: e164Phone,
        },
      })
      if (error) throw error
      const session = await signInWithPassword([{ email: accountEmail }], password)
      return new Response(JSON.stringify({
        ok: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type,
      }), { headers: CORS })
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : '账号处理失败',
      }), { headers: CORS })
    }
  }

  return new Response(JSON.stringify({ ok: false, error: '未知 action' }), { status: 400, headers: CORS })
})
