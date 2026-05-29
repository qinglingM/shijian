import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Keyboard } from '@capacitor/keyboard'

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

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white lg:max-w-3xl">
      <main
        className={cn(
          'flex-1 min-h-0 overflow-y-auto',
          hideTabs && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
        )}
      >
        <Outlet />
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
                      active ? 'font-semibold text-orange-500' : 'text-neutral-400',
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
      className="text-sm text-neutral-500"
    >
      ←
    </button>
  )
  if (centerTitle) {
    return (
      <header className="sticky top-0 z-10 flex min-h-12 items-center border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] pb-3">
        <div className="absolute left-4">{btn}</div>
        <h1 className="flex-1 text-center text-base font-medium">{title}</h1>
        {rightSlot ? (
          <div className="absolute right-4 flex shrink-0 items-center gap-1">{rightSlot}</div>
        ) : null}
      </header>
    )
  }
  return (
    <header className="sticky top-0 z-10 flex min-h-12 items-center border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] pb-3">
      {btn}
      <h1 className="ml-3 flex-1 truncate text-base font-medium">{title}</h1>
      {rightSlot ? (
        <div className="flex shrink-0 items-center gap-1">{rightSlot}</div>
      ) : null}
    </header>
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
