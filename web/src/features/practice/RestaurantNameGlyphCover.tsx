import type { Tier } from '@/lib/db'

type Density = 'tierMap' | 'practice'

/**
 * 无店铺封面：取店名至多 4 字成块，与首页食鉴图档位格（`tierMap`）或练习窄卡（`practice`）一致。
 */
export function RestaurantNameGlyphCover({
  name,
  tier,
  density = 'tierMap',
}: {
  name: string
  tier?: Tier | null
  density?: Density
}) {
  const chars = Array.from(name.replace(/\s/g, '')).slice(0, 4)
  const ink =
    tier === 'boom'
      ? 'text-white/95'
      : tier == null || density === 'practice'
        ? 'text-neutral-800'
        : 'text-neutral-800'

  if (density === 'practice') {
    if (chars.length === 2) {
      return (
        <span className={`flex items-center justify-center gap-0.5 text-[11px] font-semibold leading-tight ${ink}`}>
          {chars.map((char, i) => (
            <span key={`${char}-${i}`}>{char}</span>
          ))}
        </span>
      )
    }
    if (chars.length === 3) {
      return (
        <span className={`flex items-center justify-center gap-px text-[10px] font-semibold leading-tight ${ink}`}>
          {chars.map((char, i) => (
            <span key={`${char}-${i}`}>{char}</span>
          ))}
        </span>
      )
    }
    if (chars.length >= 4) {
      return (
        <span
          className={`grid grid-cols-2 gap-x-px gap-y-px text-[9px] font-semibold leading-none ${ink}`}
        >
          {chars.map((char, i) => (
            <span key={`${char}-${i}`}>{char}</span>
          ))}
        </span>
      )
    }
    return <span className={`text-sm font-semibold ${ink}`}>{chars[0] ?? '?'}</span>
  }

  if (chars.length === 2) {
    return (
      <span className={`flex items-center justify-center gap-1 text-lg font-semibold ${ink}`}>
        {chars.map((char, i) => (
          <span key={`${char}-${i}`}>{char}</span>
        ))}
      </span>
    )
  }

  if (chars.length === 3) {
    return (
      <span className={`flex items-center justify-center gap-0.5 text-base font-semibold ${ink}`}>
        {chars.map((char, i) => (
          <span key={`${char}-${i}`}>{char}</span>
        ))}
      </span>
    )
  }

  if (chars.length >= 4) {
    return (
      <span className={`grid grid-cols-2 gap-x-0.5 gap-y-0 text-base leading-none font-semibold ${ink}`}>
        {chars.map((char, i) => (
          <span key={`${char}-${i}`}>{char}</span>
        ))}
      </span>
    )
  }

  return <span className={`text-xl font-semibold ${ink}`}>{chars[0] ?? '?'}</span>
}
