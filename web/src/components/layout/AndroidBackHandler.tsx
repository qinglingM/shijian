import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate } from 'react-router-dom'

const ROOT_ROUTES = new Set(['/map', '/square', '/tier-map', '/me'])
const dismissers = new Map<symbol, () => void>()

function dismissTopLayer() {
  const dismiss = Array.from(dismissers.values()).at(-1)
  if (!dismiss) return false
  dismiss()
  return true
}

function fallbackRoute(pathname: string) {
  if (pathname.startsWith('/me/')) return '/me'
  if (pathname.startsWith('/square/')) return '/square'
  if (pathname.startsWith('/search') || pathname.startsWith('/tiers/')) return '/tier-map'
  return '/map'
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
      if (dismissTopLayer()) return
      if (ROOT_ROUTES.has(currentPathname)) {
        void App.minimizeApp()
      } else if ((window.history.state?.idx ?? 0) > 0) {
        navigate(-1)
      } else {
        navigate(fallbackRoute(currentPathname), { replace: true })
      }
    }

    document.addEventListener('shijianAndroidBack', handleBack)

    return () => {
      document.removeEventListener('shijianAndroidBack', handleBack)
    }
  }, [navigate])

  return null
}
