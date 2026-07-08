import { useMemo, useRef, useState } from 'react'
import { Flag, MoreVertical } from 'lucide-react'
import type { ContentReportTarget } from '@/lib/db'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { useRequireLogin } from '@/features/auth/useRequireLogin'
import { ContentReportDialog } from '@/features/reports/ContentReportDialog'

interface MenuItem {
  key: string
  label: string
  dialogTitle: string
  targetType: ContentReportTarget
  targetId: string
  snapshot: Record<string, unknown>
}

export function ContentReportMenuButton({
  items,
  buttonClassName = 'flex size-7 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-100',
  iconSize = 16,
  onReported,
}: {
  items: MenuItem[]
  buttonClassName?: string
  iconSize?: number
  onReported?: (item: MenuItem) => void
}) {
  const requireLogin = useRequireLogin()
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useAndroidBackDismiss(menuOpen, () => setMenuOpen(false))
  useAndroidBackDismiss(!!selectedItem, () => setSelectedItem(null))

  const safeItems = useMemo(() => items.filter((item) => item.targetId), [items])
  if (safeItems.length === 0) return null

  function openMenu() {
    if (!requireLogin()) return
    setMenuOpen((v) => !v)
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openMenu()
          }}
          className={buttonClassName}
          aria-label="更多操作"
        >
          <MoreVertical size={iconSize} />
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-30 mt-1 min-w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
              {safeItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    setSelectedItem(item)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-neutral-700 active:bg-neutral-50"
                >
                  <Flag size={14} strokeWidth={1.6} className="text-neutral-400" />
                  {item.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <ContentReportDialog
        open={!!selectedItem}
        title={selectedItem?.dialogTitle ?? '内容'}
        onClose={() => setSelectedItem(null)}
        report={
          selectedItem
            ? {
                targetType: selectedItem.targetType,
                targetId: selectedItem.targetId,
                snapshot: selectedItem.snapshot,
              }
            : null
        }
        onReported={() => {
          if (selectedItem) onReported?.(selectedItem)
        }}
      />
    </>
  )
}
