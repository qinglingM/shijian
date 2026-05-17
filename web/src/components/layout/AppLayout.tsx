import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Map, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  {
    to: '/map',
    label: '美食地图',
    icon: Map,
    match: (p: string) => p.startsWith('/map'),
    primary: false,
  },
  {
    to: '/',
    label: '食鉴图',
    icon: BookOpen,
    match: (p: string) => p === '/' || p.startsWith('/search'),
    primary: false,
  },
  {
    to: '/practice/step1',
    label: '食鉴',
    icon: Plus,
    match: (p: string) => p.startsWith('/practice'),
    primary: true,
  },
  {
    to: '/me',
    label: '我的',
    icon: User,
    match: (p: string) => p.startsWith('/me'),
    primary: false,
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
  const isHome = pathname === '/' || pathname === '/map'
  const hideTabs =
    pathname.startsWith('/restaurants/') ||
    pathname.startsWith('/dishes/') ||
    pathname.startsWith('/practice')

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white">
      <main
        className={cn(
          'flex-1',
          hideTabs
            ? 'pb-[max(1rem,env(safe-area-inset-bottom))]'
            : isHome
              ? 'pb-0 overflow-hidden'
              : 'pb-20',
        )}
      >
        <Outlet />
      </main>

      {!hideTabs && (
        <nav className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-white/95 backdrop-blur">
          <ul className="grid grid-cols-4">
            {TABS.map(({ to, label, icon: Icon, match, primary }) => {
              const active = match(pathname)
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={cn(
                      'flex flex-col items-center gap-1 text-xs',
                      primary ? '-mt-5 pb-2 pt-0' : 'py-2.5',
                      active && !primary ? 'text-neutral-900' : 'text-neutral-400',
                    )}
                    aria-label={primary ? '开始食鉴' : label}
                  >
                    {primary ? (
                      <span
                        className={cn(
                          'flex size-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white',
                          active
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-900 text-white',
                        )}
                      >
                        <Icon size={26} strokeWidth={2.4} />
                      </span>
                    ) : (
                      <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
                    )}
                    <span>{label}</span>
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

export function BackHeader({ title, backTo = '/' }: { title: string; backTo?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center border-b border-neutral-200 bg-white px-4">
      <Link to={backTo} className="text-sm text-neutral-500">
        ←
      </Link>
      <h1 className="ml-3 text-base font-medium">{title}</h1>
    </header>
  )
}

export function PracticeProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div
      className="border-b border-neutral-100 bg-white px-4 py-2.5"
      aria-label={`食鉴流程，第 ${current} 步`}
    >
      <div className="mx-auto flex max-w-[20rem] items-stretch justify-center sm:max-w-none -space-x-6">
        {PRACTICE_STEPS.map(({ step, label }, i) => {
          const done = step < current
          const active = step === current
          const state = active ? 'active' : done ? 'done' : 'todo'
          return (
            <div
              key={step}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center',
                i === 1 && 'z-[11]',
                i === 2 && 'z-[12]',
              )}
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
