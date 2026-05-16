import type { NavigateFunction } from 'react-router-dom'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * 开发专用：用 fixture 或匿名登录拿到「真实」Supabase JWT，RLS 照常生效。
 * - 本地 `npm run dev` 时默认开启，无需再设 `VITE_AUTH_LAX_DEV=true`。
 * - 生产打包（PROD）永不开。
 * - 若要在本地测真实登录：`.env.local` 里设 `VITE_AUTH_LAX_DEV=false` 或 `VITE_AUTH_STRICT_AUTH=true`。
 */
export const AUTH_LAX_DEV =
  !import.meta.env.PROD &&
  import.meta.env.VITE_AUTH_STRICT_AUTH !== 'true' &&
  import.meta.env.VITE_AUTH_LAX_DEV !== 'false'

/**
 * 尝试建立宽松开发会话：已有 session 则 true；否则依次 fixture 密码登录 → 匿名登录。
 */
export async function ensureLaxDevAuthenticated(): Promise<boolean> {
  if (!AUTH_LAX_DEV || !isSupabaseConfigured) return false

  const sb = getSupabase()
  const { data: cur } = await sb.auth.getSession()
  if (cur.session) return true

  const email = (import.meta.env.VITE_FIXTURE_EMAIL as string | undefined)?.trim()
  const password = import.meta.env.VITE_FIXTURE_PASSWORD as string | undefined

  if (email && password) {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (!error) return true
    console.warn('[shijian] lax dev: fixture sign-in failed:', error.message)
  }

  const { error: anonErr } = await sb.auth.signInAnonymously()
  if (!anonErr) return true
  console.warn('[shijian] lax dev: anonymous sign-in failed:', anonErr.message)

  return false
}

/** 成功则 replace 跳转并返回 true */
export async function tryLaxDevRedirect(
  navigate: NavigateFunction,
  redirect: string,
): Promise<boolean> {
  if (!AUTH_LAX_DEV) return false
  const ok = await ensureLaxDevAuthenticated()
  if (ok) navigate(redirect, { replace: true })
  return ok
}
