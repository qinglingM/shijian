import { AMAP_KEY } from '@/lib/env'
import type { PoiCandidate, PoiProvider, PoiSearchParams } from '@/lib/poi/types'

type AmapPoiRaw = {
  id?: string
  name?: string
  address?: string
  location?: string
  pname?: string
  cityname?: string
  adname?: string
  type?: string
  photos?: unknown
}

interface AmapTextResponse {
  status: string
  info?: string
  pois?: AmapPoiRaw[]
}

function splitLocation(location: string | undefined): {
  latitude: number | null
  longitude: number | null
} {
  if (!location || !location.includes(',')) return { latitude: null, longitude: null }
  const [lngRaw, latRaw] = location.split(',', 2)
  const lng = Number(lngRaw)
  const lat = Number(latRaw)
  return {
    longitude: Number.isFinite(lng) ? lng : null,
    latitude: Number.isFinite(lat) ? lat : null,
  }
}

/** 高德 place/text 的 photos：多为数组 `{ title, url }[]`，偶有 JSON 字符串 */
function firstPhotoUrl(photos: unknown): string | null {
  if (photos == null) return null
  let arr: unknown = photos
  if (typeof photos === 'string') {
    try {
      arr = JSON.parse(photos) as unknown
    } catch {
      return null
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null
  const first = arr[0]
  if (first && typeof first === 'object' && 'url' in first) {
    const url = String((first as { url: unknown }).url ?? '').trim()
    return url || null
  }
  return null
}

export class AmapPoiProvider implements PoiProvider {
  readonly source = 'amap' as const

  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search({ keyword, city }: PoiSearchParams): Promise<PoiCandidate[]> {
    const kw = keyword.trim()
    if (!kw) return []

    const params = new URLSearchParams({
      key: this.apiKey,
      keywords: kw,
      offset: '20',
      extensions: 'all',
    })
    if (city?.trim()) params.set('city', city.trim())

    const res = await fetch(`https://restapi.amap.com/v3/place/text?${params.toString()}`)
    if (!res.ok) throw new Error(`高德 POI：HTTP ${res.status}`)

    const json = (await res.json()) as AmapTextResponse
    if (json.status !== '1' || !Array.isArray(json.pois)) {
      throw new Error(`高德 POI：${json.info ?? '返回异常'}`)
    }

    return json.pois
      .filter((r) => r.id && r.name)
      .map((r) => {
        const { latitude, longitude } = splitLocation(r.location)
        const typeStr = typeof r.type === 'string' ? r.type.trim() : ''
        const primaryType = typeStr ? typeStr.split(';')[0] ?? null : null
        const cover_image_url = firstPhotoUrl(r.photos)

        return {
          poi_source: 'amap',
          poi_id: String(r.id),
          poi_name: String(r.name ?? '').trim(),
          address_text: String(r.address ?? '').trim(),
          latitude,
          longitude,
          province_name: r.pname?.trim() || null,
          city_name: r.cityname?.trim() || null,
          district_name: r.adname?.trim() || null,
          category: primaryType?.trim() || null,
          cover_image_url,
        }
      })
  }
}

export function createAmapPoiProvider(): AmapPoiProvider {
  if (!AMAP_KEY.trim())
    throw new Error('启用 VITE_POI_PROVIDER=amap 时请配置 web/src .env.local 中的 VITE_AMAP_KEY')
  return new AmapPoiProvider(AMAP_KEY)
}
