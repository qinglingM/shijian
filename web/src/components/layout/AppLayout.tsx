import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { Keyboard } from '@capacitor/keyboard'
import { HomePage } from '@/pages/HomePage'
import { HomeMap } from '@/features/map/HomeMap'
import { SquarePage } from '@/pages/SquarePage'
import { MePage } from '@/pages/MePage'

const TABS = [
  {
    to: '/map',
    label: '地图',
    match: (p: string) => p.startsWith('/map'),
  },
  {
    to: '/square',
    label: '广场',
    match: (p: string) => p.startsWith('/square'),
  },
  {
    to: '/tier-map',
    label: '食鉴图',
    match: (p: string) =>
      p === '/tier-map' || p.startsWith('/search') || p.startsWith('/tiers/'),
  },
  {
    to: '/me',
    label: '我的',
    match: (p: string) => p.startsWith('/me'),
  },
] as const

const PRACTICE_STEPS = [
  { step: 1, label: '搜店' },
  { step: 2, label: '定档' },
  { step: 3, label: '菜品' },
] as const

const PRACTICE_STEP_CLIP_A = 10
const PRACTICE_STEP_CLIP_B = 90
const PRACTICE_STEP_CLIP_C = PRACTICE_STEP_CLIP_A + (100 - PRACTICE_STEP_CLIP_B)
const PRACTICE_HEX_CLIP = `polygon(${PRACTICE_STEP_CLIP_A}% 0%, ${PRACTICE_STEP_CLIP_B}% 0%, 100% 50%, ${PRACTICE_STEP_CLIP_B}% 100%, ${PRACTICE_STEP_CLIP_A}% 100%, ${PRACTICE_STEP_CLIP_C}% 50%)`

const TAB_ROUTES = new Set(['/map', '/square', '/tier-map', '/me'])

function SwipeBackHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const start = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const directionLocked = useRef(false)
  const horizontalSwipe = useRef(false)
  const navigatingBack = useRef(false)
  const [slideX, setSlideX] = useState(0)
  const animFrame = useRef<number>(0)
  const navigateTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    function resetSwipe() {
      dragging.current = false
      directionLocked.current = false
      horizontalSwipe.current = false
      cancelAnimationFrame(animFrame.current)
      setSlideX(0)
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1 || navigatingBack.current) return
      if (e.touches[0].clientX > 30) return
      if (!window.history.length || window.history.length <= 1) return
      dragging.current = true
      directionLocked.current = false
      horizontalSwipe.current = false
      start.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!dragging.current || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - start.current.x
      const dy = e.touches[0].clientY - start.current.y
      if (!directionLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        directionLocked.current = true
        horizontalSwipe.current = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.25
      }
      if (!horizontalSwipe.current) return
      cancelAnimationFrame(animFrame.current)
      animFrame.current = requestAnimationFrame(() => setSlideX(Math.min(Math.max(0, dx) * 0.6, window.innerWidth * 0.45)))
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!dragging.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const shouldNavigateBack = horizontalSwipe.current && dx > 80
      dragging.current = false
      directionLocked.current = false
      horizontalSwipe.current = false
      cancelAnimationFrame(animFrame.current)
      if (shouldNavigateBack) {
        navigatingBack.current = true
        setSlideX(window.innerWidth)
        navigateTimer.current = window.setTimeout(() => {
          setSlideX(0)
          navigate(-1)
          navigatingBack.current = false
        }, 200)
      } else {
        setSlideX(0)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', resetSwipe)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', resetSwipe)
      cancelAnimationFrame(animFrame.current)
      if (navigateTimer.current !== undefined) {
        clearTimeout(navigateTimer.current)
      }
    }
  }, [navigate])

  return (
    <div style={{ position: 'relative' }}>
      {slideX > 0 && (
        <div
          className="fixed inset-0 z-0 flex items-center bg-neutral-100"
          aria-hidden
        >
          <div className="ml-12 flex items-center gap-2 text-neutral-400">
            <span className="text-lg">←</span>
            <span className="text-sm">返回</span>
          </div>
        </div>
      )}
      <div
        style={{
          transform: slideX > 0 ? `translateX(${slideX}px)` : undefined,
          transition: dragging.current ? 'none' : 'transform 0.25s ease-out',
          position: slideX > 0 ? 'relative' : undefined,
          zIndex: slideX > 0 ? 1 : undefined,
          boxShadow: slideX > 0 ? '-4px 0 16px rgb(0 0 0 / 0.08)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const listeners: Array<{ remove: () => void }> = []
    try {
      Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true)).then((h) => listeners.push(h))
      Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false)).then((h) => listeners.push(h))
    } catch {}
    return () => { listeners.forEach((h) => h.remove()) }
  }, [])

  const hideTabs =
    pathname.startsWith('/restaurants/') ||
    pathname.startsWith('/dishes/') ||
    pathname.startsWith('/practice')

  const isTabRoute = TAB_ROUTES.has(pathname)

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white lg:max-w-3xl">
      <main
        className={cn(
          'flex flex-col flex-1 min-h-0',
          isTabRoute ? 'overflow-hidden' : 'overflow-y-auto',
          hideTabs && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className={isTabRoute ? 'contents' : 'hidden'}>
          <div className={pathname === '/map' ? 'h-full' : 'hidden'}><HomeMap /></div>
          <div className={pathname === '/square' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><SquarePage /></div>
          <div className={pathname === '/tier-map' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><HomePage /></div>
          <div className={pathname === '/me' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><MePage /></div>
        </div>
        {!isTabRoute && <SwipeBackHandler><Outlet /></SwipeBackHandler>}
      </main>

      {!hideTabs && !keyboardOpen && (
        <nav className="shrink-0 border-t border-neutral-200 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ul className="grid grid-cols-4">
            {TABS.map(({ to, label, match }) => {
              const active = match(pathname)
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={cn(
                      'flex items-center justify-center py-2.5 text-sm',
                      `text-base ${active ? 'font-semibold text-orange-500' : 'text-neutral-400'}`,
                    )}
                    aria-label={label}
                  >
                    {label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}

export function BackHeader({ title, backTo = '/', rightSlot, centerTitle, onBack }: { title: string; backTo?: string; rightSlot?: React.ReactNode; centerTitle?: boolean; onBack?: () => void }) {
  const navigate = useNavigate()
  const shellClass = 'flex min-h-12 items-center border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] pb-3'
  const fixedShellClass = `${shellClass} fixed left-1/2 top-0 z-40 w-full max-w-md -translate-x-1/2 lg:max-w-3xl`
  const btn = (
    <button
      type="button"
      onClick={() => {
        if (onBack) {
          onBack()
        } else if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(backTo, { replace: true })
        }
      }}
      className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-1 text-sm text-neutral-500 active:bg-neutral-100 rounded-lg"
    >
      ←
    </button>
  )
  if (centerTitle) {
    return (
      <>
        <div className={shellClass} aria-hidden />
        <header className={fixedShellClass}>
          <div className="absolute left-4">{btn}</div>
          <h1 className="flex-1 text-center text-base font-medium">{title}</h1>
          {rightSlot ? (
            <div className="absolute right-4 flex shrink-0 items-center gap-1">{rightSlot}</div>
          ) : null}
        </header>
      </>
    )
  }
  return (
    <>
      <div className={shellClass} aria-hidden />
      <header className={fixedShellClass}>
        {btn}
        <h1 className="ml-3 flex-1 truncate text-base font-medium">{title}</h1>
        {rightSlot ? (
          <div className="flex shrink-0 items-center gap-1">{rightSlot}</div>
        ) : null}
      </header>
    </>
  )
}

type PracticeProgressStep = {
  step: number
  label: string
}

export function PracticeProgress({
  current,
  steps = PRACTICE_STEPS,
}: {
  current: number
  steps?: readonly PracticeProgressStep[]
}) {
  return (
    <div
      className="border-b border-neutral-100 bg-white px-4 py-2.5"
      aria-label={`食鉴流程，第 ${current} 步`}
    >
      <div className="mx-auto flex max-w-[20rem] items-stretch justify-center sm:max-w-none -space-x-6">
        {steps.map(({ step, label }, i) => {
          const done = step < current
          const active = step === current
          const state = active ? 'active' : done ? 'done' : 'todo'
          return (
            <div
              key={step}
              className="relative flex min-w-0 flex-1 flex-col items-center"
              style={{ zIndex: 10 + i }}
              aria-current={active ? 'step' : undefined}
            >
              <div
                className="relative h-7 w-full min-w-[5.75rem] max-w-[10.5rem] sm:min-w-[6.5rem] sm:max-w-[12rem]"
                style={{ clipPath: PRACTICE_HEX_CLIP }}
              >
                <div
                  className={cn(
                    'absolute inset-0',
                    state === 'todo' && 'bg-orange-50',
                    state === 'done' && 'bg-gradient-to-r from-amber-500 to-orange-500',
                    state === 'active' && 'bg-gradient-to-r from-orange-600 to-rose-600',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'relative z-[1] flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight tracking-tight sm:text-[11px]',
                    state === 'todo' && 'font-medium text-orange-800/75',
                    state === 'done' && 'font-semibold text-white',
                    state === 'active' && 'font-semibold text-white drop-shadow-[0_1px_1px_rgb(0_0_0/12%)]',
                  )}
                >
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
