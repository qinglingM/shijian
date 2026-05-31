import { useEffect, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas-pro'
import { X, Download, Loader2, Share2 } from 'lucide-react'
import type { Tier } from '@/lib/db'
import { TIER_LABEL } from '@/lib/db'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'

export interface SharePosterProps {
  open: boolean
  onClose: () => void
  restaurant: {
    name: string
    category: string | null
    address: string | null
    tier: Tier | null
    coverUrl: string | null
  }
  review: {
    nickname: string
    content: string
  } | null
  url: string
}

const TIER_COLORS: Record<string, string> = {
  top: '#e39032',
  upper: '#eddb39',
  npc: '#ede0b9',
  bad: '#f2f1ed',
  hang: '#cf5329',
  boom: '#A11A00',
}

interface PhotoLibraryPlugin {
  saveImage(options: { dataUrl: string }): Promise<void>
}

const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary')

export function SharePosterSheet({ open, onClose, restaurant, review, url }: SharePosterProps) {
  useAndroidBackDismiss(open, onClose)
  const posterRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeAction, setActiveAction] = useState<'share' | 'save' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    setErrorMsg(null)
    setToastMsg(null)
    closeButtonRef.current?.focus()
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [open, onClose])

  if (!open) return null

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMsg(message)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2500)
  }

  async function generatePoster() {
    if (!posterRef.current) throw new Error('poster element missing')

    const canvas = await html2canvas(posterRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
    })

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/png')
    })
    if (!blob) throw new Error('canvas toBlob failed')

    const file = new File([blob], `食鉴分享-${restaurant.name}.png`, { type: 'image/png' })
    return { blob, dataUrl: canvas.toDataURL('image/png'), file }
  }

  function downloadPoster(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = objectUrl
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }

  async function handleShareImage() {
    if (activeAction) return
    setActiveAction('share')
    setErrorMsg(null)

    try {
      const { blob, file } = await generatePoster()
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '食鉴分享' })
      } else {
        downloadPoster(blob, file.name)
        showToast('图片已下载，可手动分享')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to generate poster:', err)
      setErrorMsg('生成海报失败，请重试')
    } finally {
      setActiveAction(null)
    }
  }

  async function handleSaveImage() {
    if (activeAction) return
    setActiveAction('save')
    setErrorMsg(null)

    try {
      const { blob, dataUrl, file } = await generatePoster()
      if (Capacitor.isNativePlatform()) {
        await PhotoLibrary.saveImage({ dataUrl })
        showToast('已保存到相册')
      } else {
        downloadPoster(blob, file.name)
        showToast('图片已下载')
      }
    } catch (err) {
      console.error('Failed to save poster:', err)
      const message = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        message.includes('PERMISSION_DENIED') || message.includes('access denied')
          ? '未获得相册权限，请在系统设置中允许访问相册'
          : '保存图片失败，请重试'
      )
    } finally {
      setActiveAction(null)
    }
  }

  const tierLabel = restaurant.tier ? TIER_LABEL[restaurant.tier] : null

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        aria-label="关闭分享弹窗"
        className="fixed inset-0 z-[100] cursor-default bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
      >
        <div className="flex w-full max-w-[340px] max-h-[90dvh] flex-col overflow-hidden rounded-[24px] bg-neutral-100 shadow-2xl pointer-events-auto">
          <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
            <p className="text-[16px] font-bold text-neutral-900">分享店铺</p>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="关闭分享弹窗"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full bg-neutral-200/50 text-neutral-500 active:bg-neutral-200"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
            <div className="flex justify-center">
              {/* Poster Container */}
            <div
              ref={posterRef}
              className="w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-100"
            >
              {/* Cover Image Area */}
              <div className="relative h-64 w-full bg-neutral-100">
                {restaurant.coverUrl ? (
                  <img 
                    src={restaurant.coverUrl} 
                    alt="" 
                    crossOrigin={
                      restaurant.coverUrl.startsWith('http') && !restaurant.coverUrl.startsWith(window.location.origin) 
                        ? "anonymous" 
                        : undefined
                    } 
                    className="size-full object-cover" 
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
                     <span className="text-4xl opacity-20 font-black tracking-widest">{restaurant.name.slice(0, 4)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent mix-blend-multiply" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />

                {/* Large Tier Stamp */}
                {tierLabel && restaurant.tier ? (
                  <div 
                    className="absolute right-4 top-4 flex items-center justify-center rounded-lg border-[3px] border-white/95 shadow-xl rotate-[12deg] w-[72px] h-[72px] text-black"
                    style={{ backgroundColor: TIER_COLORS[restaurant.tier] || '#e39032' }}
                  >
                    <span className="text-[18px] font-black leading-none">{tierLabel}</span>
                  </div>
                ) : null}

                <div className="absolute bottom-4 left-5 right-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    {restaurant.category ? (
                      <span className="text-[12px] font-bold text-neutral-700/90 shadow-white drop-shadow-sm">
                        {restaurant.category}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-tight drop-shadow-md">
                    {restaurant.name}
                  </h1>
                  {restaurant.address ? (
                    <p className="mt-1 text-[11px] font-bold text-neutral-600 drop-shadow-md line-clamp-2">
                      {restaurant.address}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Review Area */}
              {review ? (
                <div className="px-5 pb-5 pt-3">
                  <div className="relative rounded-2xl bg-neutral-50 p-4 border border-neutral-100/60">
                    <div className="absolute -left-2 -top-4 text-6xl font-black text-orange-200 opacity-60 leading-none">“</div>
                    <p className="relative z-10 text-[13px] leading-relaxed text-neutral-800 font-bold whitespace-pre-wrap line-clamp-5">
                      {review.content}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className="size-[18px] rounded-full bg-[#e39032]/10 flex items-center justify-center text-[9px] font-black text-[#e39032]">
                        {review.nickname.slice(0, 1) || '匿'}
                      </div>
                      <span className="text-[10px] font-bold text-neutral-500">
                        @{review.nickname || '匿名用户'} 的真实食鉴
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 pb-5 pt-3">
                  <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-100/60 text-center">
                    <p className="text-[13px] font-bold text-neutral-800">该店铺暂无伯乐锐评</p>
                    <p className="mt-1 text-[11px] text-neutral-500">扫码查看详细店评和排雷指南</p>
                  </div>
                </div>
              )}

              {/* Footer Area */}
              <div className="flex items-center justify-between border-t border-neutral-100 bg-white px-5 py-4">
                <div className="flex-1 pr-3">
                  <p className="text-[13px] font-black text-neutral-900">长按扫码，看更多排雷报告</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400 font-bold tracking-wide">食鉴 - 拒绝被坑的真实餐饮指南</p>
                </div>
                <div className="size-[52px] shrink-0 rounded-lg bg-neutral-50 p-1 border border-neutral-100">
                  <QRCodeSVG value={url} size={42} />
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="mt-4 text-center text-sm font-semibold text-red-500">{errorMsg}</p>
          )}

          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-neutral-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={handleShareImage}
              disabled={activeAction !== null}
              className="flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-3 text-[14px] font-bold text-neutral-900 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {activeAction === 'share' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  生成海报中...
                </>
              ) : (
                <>
                  <Share2 size={18} strokeWidth={2.5} />
                  分享海报
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={activeAction !== null}
              className="flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-3 text-[14px] font-bold text-white shadow-xl shadow-neutral-900/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {activeAction === 'save' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Download size={18} strokeWidth={2.5} />
                  保存到相册
                </>
              )}
            </button>
          </div>
        </div>
        {toastMsg && (
          <div className="fixed bottom-10 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>
    </>
  )
}
