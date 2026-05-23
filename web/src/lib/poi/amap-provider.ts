import { AMAP_KEY } from '@/lib/env'
import type { PoiCandidate, PoiProvider, PoiSearchParams } from '@/lib/poi/types'
import { mapAmapToShijian } from '@/lib/poi/category-mapper'

type AmapPoiRaw = {
  id?: string
  name?: string
  address?: string
  location?: string
  pname?: string
  cityname?: string
  adname?: string
  type?: string
  typecode?: string
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

function parseAmapTypeStr(amapType: string): { midText: string; subText: string } | null {
  if (!amapType) return null
  const segs = amapType.split(';').map((s) => s.trim())
  return {
    midText: segs[1] ?? segs[0] ?? '',
    subText: segs[2] ?? segs[1] ?? segs[0] ?? '',
  }
}

export class AmapPoiProvider implements PoiProvider {
  readonly source = 'amap' as const

  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search({ keyword, city, signal }: PoiSearchParams): Promise<PoiCandidate[]> {
    const kw = keyword.trim()
    if (!kw) return []

    const params = new URLSearchParams({
      key: this.apiKey,
      keywords: kw,
      types: '050000',
      offset: '20',
      extensions: 'all',
    })
    if (city?.trim()) {
      params.set('city', city.trim())
      params.set('citylimit', 'true')
    }

    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(new DOMException('高德 POI 超时', 'TimeoutError')), 10_000)
    if (signal) {
      signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
    }

    const res = await fetch(`https://restapi.amap.com/v3/place/text?${params.toString()}`, {
      signal: ctrl.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`高德 POI：HTTP ${res.status}`)

    const json = (await res.json()) as AmapTextResponse
    if (json.status !== '1' || !Array.isArray(json.pois)) {
      throw new Error(`高德 POI：${json.info ?? '返回异常'}`)
    }

    return json.pois
      .filter((r) => {
        if (!r.id || !r.name) return false
        const t = typeof r.type === 'string' ? r.type.trim() : ''
        return t.startsWith('餐饮服务') || t.startsWith('餐饮')
      })
      .map((r) => {
        const { latitude, longitude } = splitLocation(r.location)
        const poiName = String(r.name ?? '').trim()
        const typeStr = typeof r.type === 'string' ? r.type.trim() : ''
        const cover_image_url = firstPhotoUrl(r.photos)

        const typeCode = typeof r.typecode === 'string' ? r.typecode.trim() : null
        const parsed = typeStr ? parseAmapTypeStr(typeStr) : null
        const mapped = typeStr ? mapAmapToShijian(typeStr, poiName) : null

        return {
          poi_source: 'amap',
          poi_id: String(r.id),
          poi_name: poiName,
          address_text: String(r.address ?? '').trim(),
          latitude,
          longitude,
          province_name: r.pname?.trim() || null,
          city_name: r.cityname?.trim() || null,
          district_name: r.adname?.trim() || null,
          category: mapped?.categoryCode ?? null,
          cover_image_url,
          amap_type_code: typeCode,
          amap_mid_category: parsed?.midText ?? null,
          amap_small_category: parsed?.subText ?? null,
          display_label: mapped?.displayLabel ?? null,
        }
      })
  }
}

export function createAmapPoiProvider(): AmapPoiProvider {
  if (!AMAP_KEY.trim())
    throw new Error('启用 VITE_POI_PROVIDER=amap 时请配置 web/src .env.local 中的 VITE_AMAP_KEY')
  return new AmapPoiProvider(AMAP_KEY)
}
