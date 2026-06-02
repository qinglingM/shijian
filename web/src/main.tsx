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
    // Android 状态栏是半透明覆盖在 WebView 上，不需要 padding
    // iOS 是挖空安全区域，必须留出空间
    const isAndroid = Capacitor.getPlatform() === 'android'
    const safeTop = isAndroid ? 0 : (info.height ?? 0)
    document.documentElement.style.setProperty('--safe-top', `${safeTop}px`)
  } catch {
    // StatusBar 插件不可用时回退到 CSS env()
    document.documentElement.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)')
  }
}
initSafeAreaVars()

// 应用加载完成后隐藏 Splash Screen
async function hideSplashScreen() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // SplashScreen 插件不可用时忽略
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)

// 在 React 渲染完成后隐藏 Splash Screen
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    hideSplashScreen()
  })
})
