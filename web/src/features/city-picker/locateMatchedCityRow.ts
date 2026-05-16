import type { CityRow } from '@/lib/db'
import {
  matchCityRowFromReverseLabel,
  reverseGeocodeLabel,
} from '@/features/city-picker/reverseMatchCity'

export type LocateMatchedCityFailureReason =
  | 'empty_cities'
  | 'position_unavailable'
  | 'reverse_failed'
  | 'no_match'

export type LocateMatchedCityResult =
  | { ok: true; row: CityRow }
  | { ok: false; reason: LocateMatchedCityFailureReason }

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300_000,
  timeout: 10_000,
}

/** 读取一次 WGS84 坐标；用户拒绝、超时或不支持时返回 `null`。 */
export function getCurrentPositionCoords(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      () => resolve(null),
      GEO_OPTS,
    )
  })
}

/**
 * 浏览器定位 → OSM 逆地理 → 与本地 `cities` 最长匹配。
 * 与 {@link CityGeolocationBootstrap} 使用同一逻辑，便于抽成「刷新定位」按钮复用。
 */
export async function locateMatchedCityRow(
  cities: CityRow[],
): Promise<LocateMatchedCityResult> {
  if (cities.length === 0) return { ok: false, reason: 'empty_cities' }

  const coords = await getCurrentPositionCoords()
  if (!coords) return { ok: false, reason: 'position_unavailable' }

  try {
    const label = await reverseGeocodeLabel(coords.latitude, coords.longitude)
    if (!label) return { ok: false, reason: 'reverse_failed' }
    const matched = matchCityRowFromReverseLabel(label, cities)
    if (!matched) return { ok: false, reason: 'no_match' }
    return { ok: true, row: matched }
  } catch {
    return { ok: false, reason: 'reverse_failed' }
  }
}
