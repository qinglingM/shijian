import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'

// 在应用启动时检测原生平台安全区域高度
// 解决 Android 和 iOS 对 env(safe-area-inset-top) 解析不一致的问题
async function initSafeAreaVars() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    const info = await StatusBar.getInfo()
    // Android 的 StatusBar height 通常是实际像素值
    // iOS 返回的是刘海屏的安全区域高度
    const safeTop = info.height ?? 0
    document.documentElement.style.setProperty('--safe-top', `${safeTop}px`)
  } catch {
    // StatusBar 插件不可用时回退到 CSS env()
    document.documentElement.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)')
  }
}
initSafeAreaVars()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
