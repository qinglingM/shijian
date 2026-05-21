import { getSupabase } from '@/lib/supabase'

type SmsOtpPayload =
  | { action: 'send'; phone: string; purpose: 'login' | 'signup' | 'forgot' }
  | { action: 'password-login'; phone: string; password: string }
  | { action: 'verify'; phone: string; code: string; token: string }
  | { action: 'complete-login'; phone: string; code: string; token: string }
  | {
      action: 'complete-signup'
      phone: string
      code: string
      token: string
      password: string
      nickname?: string
    }
  | {
      action: 'complete-forgot'
      phone: string
      code: string
      token: string
      password: string
    }

type SmsOtpResponse = {
  ok: boolean
  token?: string
  temp_password?: string
  login_phone?: string
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
}

export async function callAliyunSmsOtp(payload: SmsOtpPayload): Promise<SmsOtpResponse> {
  const { data, error } = await getSupabase().functions.invoke<SmsOtpResponse>(
    'sms-otp',
    { body: payload },
  )

  if (error) {
    return { ok: false, error: error.message || '短信服务调用失败' }
  }

  return data ?? { ok: false, error: '短信服务没有返回结果' }
}
