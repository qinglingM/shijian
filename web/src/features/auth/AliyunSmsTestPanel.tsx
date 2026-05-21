import { useEffect, useState } from 'react'
import { normalizeChinaMobileToE164 } from '@/lib/phoneE164'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-otp`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function callEdge(payload: object): Promise<{ ok: boolean; token?: string; error?: string }> {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { ok: false, error: `服务器响应异常 (${res.status})` }
  }
}

const INPUT_CLS =
  'mt-1.5 block w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none ring-orange-400/40 focus:border-orange-400 focus:ring'

export function AliyunSmsTestPanel() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function sendOtp() {
    setMsg(null)
    const e164 = normalizeChinaMobileToE164(phone)
    if (!e164) { setMsg('请输入中国大陆 11 位手机号'); return }
    setSending(true)
    try {
      const json = await callEdge({ action: 'send', phone: e164 })
      if (!json.ok) { setMsg(json.error ?? '发送失败'); return }
      setToken(json.token ?? null)
      setCode('')
      setCountdown(60)
    } catch {
      setMsg('网络错误，请重试')
    } finally {
      setSending(false)
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!token) { setMsg('请先发送验证码'); return }
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) { setMsg('请输入 6 位验证码'); return }
    const e164 = normalizeChinaMobileToE164(phone)!
    setVerifying(true)
    const json = await callEdge({ action: 'verify', phone: e164, code: digits, token })
    setVerifying(false)
    if (!json.ok) { setMsg(json.error ?? '验证失败'); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="rounded-xl bg-green-50 px-4 py-6 text-center">
        <p className="text-base font-semibold text-green-800">✓ 手机号验证成功</p>
        <p className="mt-1 text-xs text-green-600">阿里云短信通道已通</p>
        <button
          type="button"
          className="mt-4 text-xs text-neutral-500 underline underline-offset-2"
          onClick={() => { setSuccess(false); setToken(null); setCode(''); setMsg(null) }}
        >
          再次测试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-neutral-600">
        手机号
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="138 0000 0000"
          className={INPUT_CLS}
        />
      </label>

      <button
        type="button"
        disabled={sending || countdown > 0}
        onClick={sendOtp}
        className="w-full rounded-xl bg-neutral-100 py-2.5 text-sm font-medium text-neutral-700 disabled:opacity-50"
      >
        {sending ? '发送中…' : countdown > 0 ? `重新发送 (${countdown}s)` : '发送验证码'}
      </button>

      {token && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <label className="block text-xs font-medium text-neutral-600">
            验证码（6 位）
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="请输入短信中的验证码"
              className={INPUT_CLS}
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {verifying ? '验证中…' : '验证'}
          </button>
        </form>
      )}

      {msg && (
        <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">{msg}</p>
      )}

      <p className="text-[11px] leading-5 text-neutral-400">
        需在 Supabase 控制台配置 Edge Function 环境变量：
        ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_DYPNS_SCHEME_CODE
      </p>
    </div>
  )
}
