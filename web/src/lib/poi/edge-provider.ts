import { SUPABASE_FUNCTIONS_URL } from '@/lib/env'
import type { PoiCandidate, PoiProvider, PoiSearchParams, PoiSearchResult } from '@/lib/poi/types'

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
  count?: string
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

export class EdgePoiProvider implements PoiProvider {
  readonly source = 'amap' as const

  private readonly functionsUrl: string

  constructor(functionsUrl: string) {
    this.functionsUrl = functionsUrl
  }

  async search({ keyword, city, signal, page = 1, pageSize = 20 }: PoiSearchParams): Promise<PoiSearchResult> {
    const kw = keyword.trim()
    if (!kw) return { items: [], total: 0 }

    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(new DOMException('POI 搜索超时', 'TimeoutError')), 10_000)
    if (signal) {
      signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
    }

    const res = await fetch(`${this.functionsUrl}/poi-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, city, page, pageSize }),
      signal: ctrl.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(`POI 搜索失败：${(errBody as { error?: string } | null)?.error ?? `HTTP ${res.status}`}`)
    }

    const json = (await res.json()) as AmapTextResponse
    if (json.status !== '1' || !Array.isArray(json.pois)) {
      throw new Error(`POI 搜索：${json.info ?? '返回异常'}`)
    }

    const items: PoiCandidate[] = json.pois
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
          category: null,
          cover_image_url,
          amap_type_code: typeCode,
          amap_mid_category: parsed?.midText ?? null,
          amap_small_category: parsed?.subText ?? null,
          display_label: null,
        }
      })

    return { items, total: Number(json.count) || 0 }
  }
}

export function createEdgePoiProvider(): EdgePoiProvider {
  if (!SUPABASE_FUNCTIONS_URL.trim())
    throw new Error('启用 VITE_POI_PROVIDER=edge 时请配置 web/src .env.local 中的 VITE_SUPABASE_FUNCTIONS_URL')
  return new EdgePoiProvider(SUPABASE_FUNCTIONS_URL)
}
