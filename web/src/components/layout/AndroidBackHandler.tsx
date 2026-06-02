import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate } from 'react-router-dom'

import { isRootTab, resolveParentRoute } from '@/components/layout/backNavigation'

const dismissers = new Map<symbol, () => void>()

function dismissTopLayer() {
  const dismiss = Array.from(dismissers.values()).at(-1)
  if (!dismiss) return false
  dismiss()
  return true
}

export function useAndroidBackDismiss(open: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return
    const token = Symbol('android-back-dismiss')
    dismissers.set(token, () => onDismissRef.current())
    return () => {
      dismissers.delete(token)
    }
  }, [open])
}

export function AndroidBackHandler() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return

    function handleBack() {
      const currentPathname = pathnameRef.current

      // 1. 优先关闭最上层弹层
      if (dismissTopLayer()) return

      // 2. /map 是根："返回"= 最小化 App 到后台（不是关闭）
      if (currentPathname === '/map') {
        void App.minimizeApp()
        return
      }

      // 3. 其他一级 Tab：回 /map（不直接退出 App）
      if (isRootTab(currentPathname)) {
        navigate('/map', { replace: true })
        return
      }

      // 4. 其他页面：按路由表回父级，不依赖 WebView 历史栈
      navigate(resolveParentRoute(currentPathname), { replace: true })
    }

    let cleaned = false
    let listenerHandle: { remove: () => void } | null = null
    void App.addListener('backButton', handleBack).then((h) => {
      if (cleaned) {
        h.remove()
      } else {
        listenerHandle = h
      }
    })

    return () => {
      cleaned = true
      listenerHandle?.remove()
    }
  }, [navigate])

  return null
}
