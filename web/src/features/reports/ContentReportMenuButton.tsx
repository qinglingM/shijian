import { useMemo, useRef, useState } from 'react'
import { Flag, MoreVertical } from 'lucide-react'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { useRequireLogin } from '@/features/auth/useRequireLogin'

export interface ContentReportMenuPayload {
  title: string
  targets: Array<{
    label: string
    targetType: 'practice_record' | 'dish_review' | 'dish_review_image'
    targetId: string
    snapshot: Record<string, unknown>
  }>
}

export function ContentReportMenuButton({
  payload,
  buttonClassName = 'flex size-7 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-100',
  iconSize = 16,
  onOpenReport,
}: {
  payload: ContentReportMenuPayload
  buttonClassName?: string
  iconSize?: number
  onOpenReport: (payload: ContentReportMenuPayload) => void
}) {
  const requireLogin = useRequireLogin()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useAndroidBackDismiss(menuOpen, () => setMenuOpen(false))

  const safeTargets = useMemo(() => payload.targets.filter((item) => item.targetId), [payload.targets])
  if (safeTargets.length === 0) return null

  function toggleMenu() {
    if (!requireLogin()) return
    setMenuOpen((v) => !v)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggleMenu()
        }}
        className={buttonClassName}
        aria-label="更多操作"
      >
        <MoreVertical size={iconSize} />
      </button>
      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen(false)
            }}
          />
          <div
            className="absolute right-0 top-full z-30 mt-1 min-w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenuOpen(false)
                onOpenReport(payload)
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-neutral-700 active:bg-neutral-50"
            >
              <Flag size={14} strokeWidth={1.6} className="text-neutral-400" />
              举报
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
