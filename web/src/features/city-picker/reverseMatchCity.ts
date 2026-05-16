import type { CityRow } from '@/lib/db'

function stripAdministrativeSuffix(name: string) {
  return name.replace(/(市|地区|自治州|盟|县)$/u, '').trim()
}

/**
 * OSM/Nominatim 逆向地址文案与本地 cities 列表做最长匹配。
 */
export function matchCityRowFromReverseLabel(
  label: string,
  cities: CityRow[],
): CityRow | null {
  const raw = label.replace(/\s+/g, '').trim()
  if (!raw || cities.length === 0) return null

  const candidates = [...cities].sort((a, b) => b.name.length - a.name.length)

  for (const c of candidates) {
    const n = c.name
    const bare = stripAdministrativeSuffix(n)
    const patterns = uniqueNonEmpty([
      n,
      bare,
      `${n}市`,
      `${bare}市`,
    ])
    for (const p of patterns) {
      if (p.length >= 2 && raw.includes(p)) return c
    }
  }

  return null
}

function uniqueNonEmpty(xs: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const t = x.trim()
    if (t.length < 2 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export async function reverseGeocodeLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=zh-CN`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'ShijianPracticeMap/1.0 (+https://github.com/example/shijian; zh-CN)',
    },
  })

  if (!res.ok) return null
  const j = (await res.json()) as {
    display_name?: string
    address?: Record<string, string>
  }

  const a = j.address ?? {}
  const candidates = [
    a.city,
    a.town,
    a.district,
    a.village,
    a.state_district,
    a.county,
    a.state,
  ]

  for (const raw of candidates) {
    if (!raw) continue
    const p = raw.trim()
    if (p.length >= 2 && !/省/u.test(p)) return p
    if (/(市|区|县)$/u.test(p) && p.length >= 2) return p
  }

  if (j.display_name) {
    const first = j.display_name.split(',').map((s) => s.trim())[0]
    if (first && first.length >= 2) return first
  }

  return null
}
