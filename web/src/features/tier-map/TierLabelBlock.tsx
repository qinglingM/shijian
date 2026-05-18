import { Link } from 'react-router-dom'
import { TIER_LABEL, TIER_SOFT_VAR, type Tier } from '@/lib/db'

/**
 * 食鉴六档左侧方块：整块满饱和档位色；
 * 档名几何居中；数量叠底，渐变高度约 21%，黑渐变峰值 15%；数字黑色、贴近方块底。
 */
export function TierLabelBlock({
  tier,
  count,
  href,
}: {
  tier: Tier
  count: number
  href?: string
}) {
  const shellClass = 'min-h-0 min-w-0 shrink-0'
  const body = (
    <div
      className="relative aspect-square w-[90px] overflow-hidden"
      role={href ? undefined : 'group'}
      aria-label={href ? undefined : `${TIER_LABEL[tier]}档位，${count} 家`}
      style={{ background: TIER_SOFT_VAR[tier] }}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-1">
        <span
          className={`max-w-full text-center text-[clamp(15px,5.75vw,24px)] font-bold leading-tight tracking-tight text-neutral-950 [font-family:SimHei,STHeiti,"Heiti_SC","Microsoft_YaHei","PingFang_SC",sans-serif]`}
        >
          {TIER_LABEL[tier]}
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex h-[21%] items-end justify-center pb-[2px]"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.15) 100%)',
        }}
      >
        <span
          className="font-semibold tabular-nums tracking-tight text-neutral-950 [font-family:SimHei,STHeiti,'Heiti_SC','Microsoft_YaHei','PingFang_SC',sans-serif] text-[10px] leading-none sm:text-[11px]"
          aria-hidden
        >
          {count}
        </span>
      </div>
    </div>
  )

  return href ? (
    <Link to={href} className={shellClass} aria-label={`${TIER_LABEL[tier]}档位，${count} 家，查看列表`}>
      {body}
    </Link>
  ) : (
    <div className={shellClass}>{body}</div>
  )
}
