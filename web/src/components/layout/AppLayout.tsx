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

/**
 * 向上查找最近的、声明为可滚动的祖先容器（按 overflow 样式判定）。
 * 不要求当前 scrollHeight>clientHeight：resize:none 下页面正好铺满整屏、
 * 暂时无可滚内容，需先给容器加 padding 再滚，故不能用可滚状态作为判据。
 */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
    p = p.parentElement
  }
  return null
}

export function AppLayout() {
  const { pathname } = useLocation()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  // 键盘弹起时被加 padding 的滚动容器，及其原始 inline paddingBottom，供收起时还原
  const scrollerRef = useRef<HTMLElement | null>(null)
  const prevPadRef = useRef('')

  useEffect(() => {
    // resize:none —— WebView 永不缩放，键盘纯浮在内容上方，不会产生白边/视口跳动。
    // 由我们手动给滚动容器加 padding 腾出空间，并把聚焦输入框滚到键盘上方。
    const listeners: Array<{ remove: () => void }> = []

    function restorePadding() {
      const scroller = scrollerRef.current
      if (scroller) scroller.style.paddingBottom = prevPadRef.current
      scrollerRef.current = null
    }

    // 点击/触摸输入框以外的任意位置，主动 blur 收起键盘（iOS WebView 默认不会自动收）。
    // capture 阶段先于目标自身处理，blur 不会阻断后续 click/导航。点到另一表单控件
    // 时跳过，避免“收起再弹起”的闪烁。
    function dismissKeyboardOnOutsideTap(e: PointerEvent) {
      const active = document.activeElement as HTMLElement | null
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, label, [contenteditable]')) return
      active.blur()
    }
    document.addEventListener('pointerdown', dismissKeyboardOnOutsideTap, true)

    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardOpen(true)
        const kbH = info?.keyboardHeight ?? 0
        // iOS 切换输入框会重复触发 willShow，先无条件还原，避免 padding 叠加污染
        restorePadding()
        if (kbH <= 0) return
        const active = document.activeElement as HTMLElement | null
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return
        const scroller = findScrollParent(active) ?? mainRef.current
        if (!scroller) return
        // 还原后读取的是干净的原始 padding，叠加键盘高度腾出可滚空间
        const basePad = getComputedStyle(scroller).paddingBottom
        prevPadRef.current = scroller.style.paddingBottom
        scrollerRef.current = scroller
        scroller.style.paddingBottom = `calc(${basePad} + ${kbH}px)`
        // rAF 等 padding 生效后再测量并滚动
        requestAnimationFrame(() => {
          const rect = active.getBoundingClientRect()
          // resize:none 下 innerHeight 仍是整屏高，减去键盘高即可见区底边
          const safeBottom = window.innerHeight - kbH - 16
          if (rect.bottom > safeBottom) {
            scroller.scrollBy({ top: rect.bottom - safeBottom, behavior: 'smooth' })
          }
        })
      }).then((h) => listeners.push(h))

      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardOpen(false)
        restorePadding()
      }).then((h) => listeners.push(h))
    } catch {}
    return () => {
      listeners.forEach((h) => h.remove())
      document.removeEventListener('pointerdown', dismissKeyboardOnOutsideTap, true)
    }
  }, [])

  const hideTabs =
    pathname.startsWith('/restaurants/') ||
    pathname.startsWith('/dishes/') ||
    pathname.startsWith('/practice')

  const isTabRoute = TAB_ROUTES.has(pathname)

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white lg:max-w-3xl">
      <main
        ref={mainRef}
        className={cn(
          // relative：作为绝对定位后代的包含块。否则 sr-only 的隐藏 file input
          // 等 position:absolute 元素会以 ICB(html) 为包含块，按其静态位置撑高
          // document.scrollHeight，使整个页面可向下滚出大片空白（菜品越多越长）。
          'relative flex flex-col flex-1 min-h-0',
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
        {!isTabRoute && <Outlet />}
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
                    replace
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
  const shellClass = 'flex shrink-0 items-center border-b border-neutral-200 bg-white px-4 pb-3'
  const shellStyle = { height: 'calc(3.5625rem + var(--safe-top))', paddingTop: 'var(--safe-top)' }
  const fixedShellClass = `${shellClass} fixed left-1/2 top-0 z-40 w-full max-w-md -translate-x-1/2 lg:max-w-3xl`
  const btn = (
    <button
      type="button"
      onClick={() => {
        if (onBack) {
          onBack()
        } else if ((window.history.state?.idx ?? 0) > 0) {
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
        <div className={shellClass} style={shellStyle} aria-hidden />
        <header className={fixedShellClass} style={shellStyle}>
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
      <div className={shellClass} style={shellStyle} aria-hidden />
      <header className={fixedShellClass} style={shellStyle}>
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
