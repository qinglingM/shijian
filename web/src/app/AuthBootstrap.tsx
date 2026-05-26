import { useEffect, useRef, type ReactNode } from 'react'
import { CityGeolocationBootstrap } from '@/features/city-picker/CityGeolocationBootstrap'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase'
import { AUTH_LAX_DEV, ensureLaxDevAuthenticated } from '@/lib/laxDevAuth'
import { useAuthStore } from '@/stores/authStore'
import { StatusBar, Style } from '@capacitor/status-bar'

const FIXTURE_EMAIL = import.meta.env.VITE_FIXTURE_EMAIL as string | undefined
const FIXTURE_PASSWORD = import.meta.env.VITE_FIXTURE_PASSWORD as string | undefined
/** 显式为 true 时才自动 fixture 登录，避免与真实登录流程冲突 */
const FIXTURE_AUTO_LOGIN = import.meta.env.VITE_FIXTURE_AUTO_LOGIN === 'true'

/**
 * 在 App 启动时：
 * 1. 读取当前 session
 * 2. 开发环境（非 PROD）且未显式关闭时：无 session 则尝试 fixture 或匿名登录
 * 3. 若未登录且 VITE_FIXTURE_AUTO_LOGIN=true 且配置了 fixture 凭据，自动登录
 * 4. 订阅 supabase auth 状态变更
 * 5. 标记 ready=true
 *
 * 这是 P0 跳过登录页方案的核心：dev 阶段始终以 fixture 用户身份发请求。
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession)
  const setReady = useAuthStore((s) => s.setReady)
  const ready = useAuthStore((s) => s.ready)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }

    const supabase = getSupabase()

    async function restoreDevSession() {
      if (!AUTH_LAX_DEV) return false
      const ok = await ensureLaxDevAuthenticated()
      if (!ok) return false
      const { data: again } = await supabase.auth.getSession()
      if (again.session) {
        setSession(again.session)
        return true
      }
      return false
    }

    async function init() {
      const timeout = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('[shijian] auth init timed out, forcing ready')
          resolve()
        }, 10_000)
      })

      const main = (async () => {
        try { await StatusBar.setStyle({ style: Style.Dark }) } catch { /* 浏览器环境忽略 */ }
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          const { data: userData, error } = await supabase.auth.getUser()
          if (!error && userData.user) {
            setSession(data.session)
          } else {
            setSession(null)
            await supabase.auth.signOut()
            const restored = await restoreDevSession()
            if (!restored && !import.meta.env.PROD) {
              console.warn('[shijian] cached Supabase session is invalid:', error?.message)
            }
          }
        } else if (AUTH_LAX_DEV) {
          const restored = await restoreDevSession()
          if (!restored && !import.meta.env.PROD) {
            console.warn('[shijian] dev: 所有 Supabase Auth 方式均失败，使用开发降级身份')
          }
        } else if (FIXTURE_AUTO_LOGIN && FIXTURE_EMAIL && FIXTURE_PASSWORD) {
          const { data: signIn, error } = await supabase.auth.signInWithPassword({
            email: FIXTURE_EMAIL,
            password: FIXTURE_PASSWORD,
          })
          if (error) {
            console.warn('[shijian] fixture sign-in failed:', error.message)
          } else {
            setSession(signIn.session)
          }
        }
      })()

      await Promise.race([main, timeout])
      setReady(true)
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [setSession, setReady])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-neutral-400">
        载入中…
      </div>
    )
  }

  return (
    <CityGeolocationBootstrap>
      {children}
    </CityGeolocationBootstrap>
  )
}
