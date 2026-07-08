import { useEffect, useMemo, useState } from 'react'
import type { ContentReportReason } from '@/lib/db'
import { REPORT_REASON_OPTIONS } from '@/features/reports/reportConstants'
import { useSubmitContentReportMutation, type SubmitContentReportInput } from '@/features/reports/useSubmitContentReportMutation'

export function ContentReportDialog({
  open,
  title,
  onClose,
  report,
  onReported,
}: {
  open: boolean
  title: string
  onClose: () => void
  report: Omit<SubmitContentReportInput, 'reasonCode' | 'description'> | null
  onReported?: () => void
}) {
  const mutation = useSubmitContentReportMutation()
  const [reasonCode, setReasonCode] = useState<ContentReportReason>('abuse')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReasonCode('abuse')
    setDescription('')
    setError(null)
  }, [open])

  const selectedReason = useMemo(
    () => REPORT_REASON_OPTIONS.find((item) => item.code === reasonCode),
    [reasonCode],
  )

  if (!open || !report) return null
  const currentReport = report

  async function handleSubmit() {
    const trimmed = description.trim()
    if (reasonCode === 'other' && !trimmed) {
      setError('请选择“其他”时请补充说明')
      return
    }

    setError(null)
    try {
      const payload: SubmitContentReportInput = {
        targetType: currentReport.targetType,
        targetId: currentReport.targetId,
        snapshot: currentReport.snapshot,
        reasonCode,
        description: trimmed,
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

  return (
    <>
      <button type="button" className="fixed inset-0 z-[70] bg-black/40" aria-label="关闭举报弹窗" onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-5 shadow-xl">
          <h2 className="text-base font-semibold text-neutral-900">举报{title}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">提交后，该内容会先对你折叠隐藏，平台会收到举报并进行处理。</p>

          <div className="mt-4 space-y-2">
            {REPORT_REASON_OPTIONS.map((item) => (
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
              rows={4}
              placeholder="补充你看到的问题，方便平台判断"
              className="mt-1.5 w-full resize-none rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-300"
            />
          </div>

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
}
