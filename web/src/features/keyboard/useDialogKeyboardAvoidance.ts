import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { Keyboard } from '@capacitor/keyboard'

function scrollActiveFieldIntoView(container: HTMLElement | null, target?: EventTarget | null) {
  if (!container) return
  const field = target instanceof HTMLElement ? target : (document.activeElement as HTMLElement | null)
  if (!field || !container.contains(field)) return
  requestAnimationFrame(() => {
    field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  })
}

export function useDialogKeyboardAvoidance(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [bottomInset, setBottomInset] = useState(0)

  const syncFromViewport = useCallback(() => {
    if (!enabled || !window.visualViewport) return
    const viewport = window.visualViewport
    const inset = Math.max(window.innerHeight - viewport.height - viewport.offsetTop, 0)
    setBottomInset((prev) => (Math.abs(prev - inset) <= 1 ? prev : inset))
    if (inset > 0) scrollActiveFieldIntoView(containerRef.current)
  }, [containerRef, enabled])

  const onFieldFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    scrollActiveFieldIntoView(containerRef.current, e.target)
  }, [containerRef])

  useEffect(() => {
    if (!enabled) {
      setBottomInset(0)
      return
    }

    const listeners: Array<{ remove: () => void }> = []
    syncFromViewport()

    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', syncFromViewport)
      viewport.addEventListener('scroll', syncFromViewport)
    }

    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        const inset = info?.keyboardHeight ?? 0
        setBottomInset(inset)
        if (inset > 0) scrollActiveFieldIntoView(containerRef.current)
      }).then((handle) => listeners.push(handle))

      Keyboard.addListener('keyboardWillHide', () => {
        setBottomInset(0)
      }).then((handle) => listeners.push(handle))
    } catch {
      // Browser preview fallback relies on visualViewport only.
    }

    return () => {
      listeners.forEach((handle) => handle.remove())
      viewport?.removeEventListener('resize', syncFromViewport)
      viewport?.removeEventListener('scroll', syncFromViewport)
      setBottomInset(0)
    }
  }, [containerRef, enabled, syncFromViewport])

  return {
    bottomInset,
    keyboardOpen: bottomInset > 0,
    onFieldFocus,
  }
}

export function blurOnEnterDone(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  e.preventDefault()
  e.currentTarget.blur()
}
