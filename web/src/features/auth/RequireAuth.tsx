import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** 配置了 Supabase 时要求已登录；未配置则放行（沿用本地/mock 调试路径）。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isSupabaseConfigured) return children

  if (!user) {
    const to = `/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`
    return <Navigate to={to} replace />
  }

  return children
}
