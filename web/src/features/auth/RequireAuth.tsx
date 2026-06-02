import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isRegisteredUser, loginPath } from '@/features/auth/useRequireLogin'

/** 配置了 Supabase 时要求已登录；未配置则放行（沿用本地/mock 调试路径）。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isSupabaseConfigured) return children

  /* 开发环境（npm run dev）跳过登录检查，方便本地调试 */
  if (!import.meta.env.PROD) return children

  if (!isRegisteredUser(user)) {
    const to = loginPath(location.pathname + location.search)
    return <Navigate to={to} replace />
  }

  return children
}
