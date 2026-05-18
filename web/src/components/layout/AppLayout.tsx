import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { BookOpen, Map, Plus, User, Sparkles, ArrowUp } from 'lucide-react'
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
    to: '/square',
    label: '广场',
    icon: Sparkles,
    match: (p: string) => p.startsWith('/square'),
    primary: false,
  },
  {
    label: '食鉴',
    icon: Plus,
    primary: true,
  },
  {
    to: '/tier-map',
    label: '食鉴图',
    icon: BookOpen,
    match: (p: string) =>
      p === '/tier-map' || p.startsWith('/search') || p.startsWith('/tiers/'),
    primary: false,
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const isHome = pathname === '/' || pathname === '/map' || pathname === '/tier-map'
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
          <ul className="grid grid-cols-5">
            {TABS.map(({ to, label, icon: Icon, match, primary }) => {
              const active = to ? match?.(pathname) : false
              if (primary) {
                return (
                  <li key="publish" className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setSheetOpen(true)}
                      className="flex flex-col items-center gap-1 -mt-5 pb-2 pt-0 text-xs text-neutral-400"
                      aria-label="开始食鉴"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg ring-4 ring-white">
                        <Icon size={26} strokeWidth={2.4} />
                      </span>
                      <span>{label}</span>
                    </button>
                  </li>
                )
              }
              return (
                <li key={to}>
                  <NavLink
                    to={to!}
                    className={cn(
                      'flex flex-col items-center gap-1 text-xs',
                      'py-2.5',
                      active ? 'text-neutral-900' : 'text-neutral-400',
                    )}
                    aria-label={label}
                  >
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {sheetOpen ? <PublishSheet onClose={() => setSheetOpen(false)} /> : null}
    </div>
  )
}

function PublishSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-200" />
        <p className="text-center text-sm font-semibold text-neutral-900">选择发布类型</p>
        <div className="mt-4 space-y-3">
          <Link to="/practice/step1" className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-6" onClick={onClose}>
            <span>
              <span className="block text-sm font-semibold text-neutral-900">发食鉴</span>
              <span className="block text-xs text-neutral-500">公开食鉴会自动变成广场封面卡片</span>
            </span>
            <ArrowUp size={16} className="text-neutral-400" />
          </Link>
          <Link to="/square/post/new" className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4" onClick={onClose}>
            <span>
              <span className="block text-sm font-semibold text-neutral-900">发帖子</span>
              <span className="block text-xs text-neutral-500">上传首图，填标题和内容</span>
            </span>
            <ArrowUp size={16} className="text-neutral-400" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function BackHeader({ title, backTo = '/', rightSlot }: { title: string; backTo?: string; rightSlot?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center border-b border-neutral-200 bg-white px-4">
      <Link to={backTo} className="text-sm text-neutral-500">
        ←
      </Link>
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
