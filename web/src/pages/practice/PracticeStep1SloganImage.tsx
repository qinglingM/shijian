import { useLayoutEffect, useRef } from 'react'

const LINES = ['绝对客观', '用户至上', '点评犀利'] as const
const ARIA = '绝对客观，用户至上，点评犀利'

export function PracticeStep1SloganImage({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const paint = () => {
      const cssW = Math.max(1, wrap.clientWidth)
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2)

      const fontSize = Math.min(cssW * 0.138, 52)
      const lineGap = fontSize * 0.42
      const lineStep = fontSize * 1.28 + lineGap
      const vertPad = Math.max(20, fontSize * 0.45)
      const adornV = fontSize * 1.35

      const blockH = lineStep * LINES.length - lineGap
      const cssH = Math.ceil(vertPad * 2 + blockH + adornV)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const cx = cssW / 2
      const yFirst =
        (cssH - blockH) / 2 + (fontSize * 1.28) / 2
      const yLast = yFirst + lineStep * (LINES.length - 1)

      ctx.font = `600 ${fontSize}px "STSong","SimSun","Noto Serif SC","Source Han Serif SC","Songti SC",serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      let maxTextW = 0
      for (const line of LINES) {
        maxTextW = Math.max(maxTextW, ctx.measureText(line).width)
      }

      const boxPadX = fontSize * 0.62
      const boxPadY = fontSize * 0.72
      const boxL = cx - maxTextW / 2 - boxPadX
      const boxR = cx + maxTextW / 2 + boxPadX
      const boxT = yFirst - boxPadY
      const boxB = yLast + boxPadY
      const bracketLen = Math.min(
        fontSize * 0.78,
        Math.max(10, (boxR - boxL) * 0.09),
      )
      const strokeW = Math.max(1, fontSize * 0.032)

      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = strokeW
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.38)'

      // 四角简约括弧
      ctx.beginPath()
      ctx.moveTo(boxL, boxT + bracketLen)
      ctx.lineTo(boxL, boxT)
      ctx.lineTo(boxL + bracketLen, boxT)
      ctx.moveTo(boxR - bracketLen, boxT)
      ctx.lineTo(boxR, boxT)
      ctx.lineTo(boxR, boxT + bracketLen)
      ctx.moveTo(boxL, boxB - bracketLen)
      ctx.lineTo(boxL, boxB)
      ctx.lineTo(boxL + bracketLen, boxB)
      ctx.moveTo(boxR - bracketLen, boxB)
      ctx.lineTo(boxR, boxB)
      ctx.lineTo(boxR, boxB - bracketLen)
      ctx.stroke()

      // 顶、底细线与中心小点缀
      const ruleInset = bracketLen + fontSize * 0.15
      const ruleYTop = boxT - fontSize * 0.28
      const ruleYBot = boxB + fontSize * 0.28

      ctx.globalAlpha = 0.55
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      ctx.lineWidth = Math.max(0.8, strokeW * 0.85)
      ctx.beginPath()
      ctx.moveTo(boxL + ruleInset, ruleYTop)
      ctx.lineTo(boxR - ruleInset, ruleYTop)
      ctx.moveTo(boxL + ruleInset, ruleYBot)
      ctx.lineTo(boxR - ruleInset, ruleYBot)
      ctx.stroke()
      ctx.globalAlpha = 1

      // 菱花小记（顶线中央）
      const rh = fontSize * 0.11
      ctx.fillStyle = 'rgba(234, 88, 12, 0.32)'
      ctx.beginPath()
      ctx.moveTo(cx, ruleYTop - rh)
      ctx.lineTo(cx + rh, ruleYTop)
      ctx.lineTo(cx, ruleYTop + rh)
      ctx.lineTo(cx - rh, ruleYTop)
      ctx.closePath()
      ctx.fill()

      // 两侧极淡的竖向点阵
      const dotR = fontSize * 0.055
      ctx.fillStyle = 'rgba(71, 85, 105, 0.22)'
      ;[-1, 1].forEach((side) => {
        const bx = side < 0 ? boxL - fontSize * 0.55 : boxR + fontSize * 0.55
        for (let i = 0; i < 3; i += 1) {
          const ty = yFirst + (i - 1) * lineStep
          ctx.beginPath()
          ctx.arc(bx, ty, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      ctx.restore()

      // 文案
      ctx.save()
      ctx.font = `600 ${fontSize}px "STSong","SimSun","Noto Serif SC","Source Han Serif SC","Songti SC",serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      let y = yFirst
      LINES.forEach((line) => {
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)'
        ctx.shadowBlur = fontSize * 0.08
        ctx.shadowOffsetY = fontSize * 0.04

        const g = ctx.createLinearGradient(
          0,
          y - fontSize * 0.6,
          0,
          y + fontSize * 0.5,
        )
        g.addColorStop(0, '#0f172a')
        g.addColorStop(1, '#475569')
        ctx.fillStyle = g
        ctx.fillText(line, cx, y)

        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
        y += lineStep
      })
      ctx.restore()
    }

    const run = () => {
      const done = () => paint()
      if (document.fonts?.ready) {
        void document.fonts.ready.then(done)
      } else {
        requestAnimationFrame(done)
      }
    }

    const ro = new ResizeObserver(() => paint())
    ro.observe(wrap)
    run()

    return () => {
      ro?.disconnect()
    }
  }, [])

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        className="mx-auto block max-h-none w-full select-none"
        role="img"
        aria-label={ARIA}
      />
    </div>
  )
}
