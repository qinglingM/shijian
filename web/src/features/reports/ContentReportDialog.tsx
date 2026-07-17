import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentReportReason, ContentReportTarget } from '@/lib/db'
import { useAuthStore } from '@/stores/authStore'
import { blurOnEnterDone, useDialogKeyboardAvoidance } from '@/features/keyboard/useDialogKeyboardAvoidance'
import { getReportReasons } from '@/features/reports/reportConstants'
import { useSubmitContentReportMutation, type SubmitContentReportInput } from '@/features/reports/useSubmitContentReportMutation'

interface ReportTargetOption {
  label: string
  targetType: ContentReportTarget
  targetId: string
  snapshot: Record<string, unknown>
}

export function ContentReportDialog({
  open,
  title,
  onClose,
  targets,
  onReported,
}: {
  open: boolean
  title: string
  onClose: () => void
  targets: ReportTargetOption[]
  onReported?: () => void
}) {
  const mutation = useSubmitContentReportMutation()
  const viewerId = useAuthStore((s) => s.user?.id ?? null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [reasonCode, setReasonCode] = useState<ContentReportReason>('abuse')
  const [targetIndex, setTargetIndex] = useState(0)
  const [description, setDescription] = useState('')
  const [blockUser, setBlockUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { bottomInset, keyboardOpen, onFieldFocus } = useDialogKeyboardAvoidance(dialogRef, open)

  useEffect(() => {
    if (!open) return
    setReasonCode('abuse')
    setTargetIndex(0)
    setDescription('')
    setBlockUser(false)
    setError(null)
  }, [open])

  const safeTargets = targets.filter((item) => item.targetId)
  const resolvedTargetType: ContentReportTarget = safeTargets[Math.min(targetIndex, safeTargets.length - 1)]?.targetType ?? 'dish_review'

  const currentReasons = useMemo(() => getReportReasons(resolvedTargetType), [resolvedTargetType])

  const selectedReason = useMemo(
    () => currentReasons.find((item) => item.code === reasonCode),
    [reasonCode, currentReasons],
  )

  if (!open || safeTargets.length === 0) return null
  const currentTarget = safeTargets[Math.min(targetIndex, safeTargets.length - 1)]
  const snapshotUserId = typeof currentTarget.snapshot.user_id === 'string' ? currentTarget.snapshot.user_id : null
  const canBlockUser = Boolean(snapshotUserId && snapshotUserId !== viewerId)

  async function handleSubmit() {
    const trimmed = description.trim()
    if (reasonCode === 'other' && !trimmed) {
      setError('请选择“其他”时请补充说明')
      return
    }

    setError(null)
    try {
      const payload: SubmitContentReportInput = {
        targetType: currentTarget.targetType,
        targetId: currentTarget.targetId,
        snapshot: currentTarget.snapshot,
        reasonCode,
        description: trimmed,
        blockUserId: snapshotUserId,
        blockUser: canBlockUser && blockUser,
      }
      await mutation.mutateAsync({
        ...payload,
      })
      onReported?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '举报失败，请稍后重试')
    }
  }

  const dialog = (
    <>
      <button type="button" className="fixed inset-0 z-[1200] bg-black/40" aria-label="关闭举报弹窗" onClick={onClose} />
      <div
        ref={(node) => {
          dialogRef.current = node
        }}
        className={`fixed inset-0 z-[1201] flex justify-center overflow-y-auto px-4 pt-4 ${keyboardOpen ? 'items-end' : 'items-center'}`}
        style={{ paddingBottom: `calc(1rem + ${bottomInset}px)` }}
      >
        <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-5 shadow-xl" style={{ maxHeight: 'calc(100dvh - var(--safe-top) - 2rem)' }}>
          <h2 className="text-base font-semibold text-neutral-900">举报{title}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">提交后，该内容会先对你折叠隐藏，平台会收到举报并进行处理。</p>

          {safeTargets.length > 1 ? (
            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-700">举报对象</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {safeTargets.map((item, index) => (
                  <button
                    key={`${item.targetType}:${item.targetId}`}
                    type="button"
                    onClick={() => setTargetIndex(index)}
                    className={`rounded-2xl border px-3 py-2 text-sm transition-colors ${index === targetIndex ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-neutral-200 text-neutral-700'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {currentReasons.map((item) => (
              <label
                key={item.code}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors ${reasonCode === item.code ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-neutral-200 text-neutral-700'}`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={item.code}
                  checked={reasonCode === item.code}
                  onChange={() => setReasonCode(item.code)}
                  className="size-4 accent-orange-500"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-neutral-700">
              补充说明
              <span className="ml-1 text-neutral-400">{selectedReason?.code === 'other' ? '（必填）' : '（选填）'}</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={onFieldFocus}
              onKeyDown={blurOnEnterDone}
              rows={4}
              placeholder="补充你看到的问题，方便平台判断"
              enterKeyHint="done"
              className="mt-1.5 w-full resize-none rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-300"
            />
          </div>

          {canBlockUser ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 px-3 py-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={blockUser}
                onChange={(e) => setBlockUser(e.target.checked)}
                className="mt-0.5 size-4 accent-orange-500"
              />
              <span>
                <span className="font-medium text-neutral-900">屏蔽该用户</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                  屏蔽后，该用户发布的评价和相关公开内容将不再对你显示。
                </span>
              </span>
            </label>
          ) : null}

          {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 rounded-2xl border border-neutral-200 py-3 text-sm font-medium text-neutral-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={mutation.isPending}
              className="flex-1 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {mutation.isPending ? '提交中…' : '提交举报'}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(dialog, document.body)
}
