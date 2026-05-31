import { useState, useEffect, useRef } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'

type FeedbackType = 'error_info' | 'duplicate'

const FEEDBACK_LABEL: Record<FeedbackType, string> = {
  error_info: '反馈错误信息',
  duplicate: '反馈重复店铺',
}

interface Props {
  open: boolean
  onClose: () => void
  restaurantId: string
  restaurantName: string
}

export function RestaurantFeedbackDialog({ open, onClose, restaurantId, restaurantName }: Props) {
  useAndroidBackDismiss(open, onClose)
  const [type, setType] = useState<FeedbackType>('error_info')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setType('error_info')
    setDescription('')
    setContact('')
    setDone(false)
    setError(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (f.length === 0) return
        const first = f[0]; const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit() {
    const desc = description.trim()
    if (!desc) { setError('请描述你遇到的问题'); return }
    if (!isSupabaseConfigured) { setError('暂无可用后端'); return }

    setSubmitting(true)
    setError(null)
    try {
      const sb = getSupabase()
      const { error: err } = await sb.from('restaurant_feedbacks').insert({
        restaurant_id: restaurantId,
        feedback_type: type,
        description: desc,
        contact: contact.trim() || null,
      })
      if (err) throw err
      setDone(true)
    } catch (e) {
      console.error('feedback submit error', e)
      setError((e as { message?: string })?.message ?? '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" aria-label="关闭" className="fixed inset-0 z-40 cursor-default bg-black/40" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-xl">
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-[17px] font-semibold text-neutral-900">反馈</h2>
            <p className="mt-1 text-[12px] text-neutral-500">店铺：{restaurantName}</p>
          </div>

          {done ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-neutral-800">感谢你的反馈！</p>
              <p className="mt-1 text-xs text-neutral-500">我们会尽快处理。</p>
              <button type="button" onClick={onClose} className="mt-5 rounded-full bg-orange-500 px-6 py-2 text-xs font-semibold text-white">关闭</button>
            </div>
          ) : (
            <>
              <div className="px-5 pt-2 pb-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-700">反馈类型</label>
                  <div className="mt-1.5 flex gap-2">
                    {(Object.entries(FEEDBACK_LABEL) as [FeedbackType, string][]).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setType(k)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${type === k ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700">问题描述</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="请详细描述你遇到的问题…"
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-orange-300 min-h-[80px] resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700">联系方式 <span className="text-neutral-400">（选填）</span></label>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="手机号或微信，方便我们联系你"
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-orange-300"
                  />
                </div>
                {error && <p className="text-xs text-rose-500">{error}</p>}
              </div>
              <div className="flex gap-3 border-t border-neutral-100 px-5 py-4">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-xs font-semibold text-neutral-600">取消</button>
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                >{submitting ? '提交中…' : '提交反馈'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
