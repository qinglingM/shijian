import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import './index.css'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'

async function syncAndroidStatusBarInset() {
  if (Capacitor.getPlatform() !== 'android') return

  try {
    const { height } = await StatusBar.getInfo()
    document.documentElement.style.setProperty('--app-safe-area-inset-top', `${height}px`)
  } catch (error) {
    console.warn('[shijian] Unable to read Android status bar height:', error)
  }
}

void syncAndroidStatusBarInset()
window.addEventListener('resize', () => void syncAndroidStatusBarInset())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
