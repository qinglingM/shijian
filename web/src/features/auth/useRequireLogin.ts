import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/authStore'

export function loginPath(redirect: string) {
  return `/auth?redirect=${encodeURIComponent(redirect)}`
}

export function isRegisteredUser(user: User | null): user is User {
  return !!user && user.is_anonymous !== true
}

export function useRequireLogin() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(() => {
    if (isRegisteredUser(user)) return true
    navigate(loginPath(location.pathname + location.search))
    return false
  }, [location.pathname, location.search, navigate, user])
}
