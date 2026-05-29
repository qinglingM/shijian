import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { cropImageToBlob } from '@/lib/cropImage'

type ImageCropDialogProps = {
  open: boolean
  imageUrl: string | null
  title: string
  cropShape: 'round' | 'rect'
  outputSize: number
  onCancel: () => void
  onConfirm: (blob: Blob) => void | Promise<void>
}

export function ImageCropDialog({
  open,
  imageUrl,
  title,
  cropShape,
  outputSize,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
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
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open || !imageUrl) return null

  async function confirmCrop() {
    if (!croppedAreaPixels || !imageUrl || saving) return
    setSaving(true)
    setError(null)
    try {
      const blob = await cropImageToBlob({
        imageUrl,
        crop: croppedAreaPixels,
        outputSize,
      })
      await onConfirm(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : '裁剪失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex flex-col bg-black/80">
      <div className="flex h-12 shrink-0 items-center justify-center px-4 pt-[env(safe-area-inset-top)] text-white">
        <p className="text-sm font-medium">{title}</p>
      </div>

      <div className="relative min-h-0 flex-1">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
        />
      </div>

      <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <label className="block text-xs text-white/70">
          缩放
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-3 block w-full accent-orange-400"
          />
        </label>
        {cropShape === 'round' ? (
          <p className="mt-3 text-center text-xs text-white/50">圆形为头像展示范围，实际保存为正方形图片。</p>
        ) : (
          <p className="mt-3 text-center text-xs text-white/50">菜品后续会用圆角正方形展示。</p>
        )}
        {error ? <p className="mt-3 text-center text-xs text-rose-200">{error}</p> : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/30 py-3 text-sm font-semibold text-white active:bg-white/10"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void confirmCrop()}
            disabled={saving}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 active:bg-orange-600"
          >
            {saving ? '处理中…' : '完成'}
          </button>
        </div>
      </div>
    </div>
  )
}
