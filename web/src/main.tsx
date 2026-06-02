import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'

const safeTopFallback = 'env(safe-area-inset-top, 0px)'

function setSafeTop(height: number) {
  document.documentElement.style.setProperty('--safe-top', `${Math.max(height, 0)}px`)
}

function resetSafeTop() {
  document.documentElement.style.setProperty('--safe-top', safeTopFallback)
}

// Android 16 强制使用 edge-to-edge，状态栏会覆盖 WebView。
// 使用原生状态栏高度补偿，解决 CSS env() 在不同 WebView 中取值不一致的问题。
async function initSafeAreaVars() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const [{ StatusBar }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/app'),
    ])

    const syncSafeTop = async () => {
      try {
        const info = await StatusBar.getInfo()
        setSafeTop(info.visible ? info.height : 0)
      } catch {
        resetSafeTop()
      }
    }

    await syncSafeTop()
    await StatusBar.addListener('statusBarVisibilityChanged', (info) => {
      setSafeTop(info.visible ? info.height : 0)
    })
    await StatusBar.addListener('statusBarOverlayChanged', (info) => {
      setSafeTop(info.visible ? info.height : 0)
    })
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncSafeTop()
    })
    window.addEventListener('resize', () => {
      void syncSafeTop()
    })
  } catch {
    // StatusBar 插件不可用时回退到 CSS env()
    resetSafeTop()
  }
}
void initSafeAreaVars()

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
