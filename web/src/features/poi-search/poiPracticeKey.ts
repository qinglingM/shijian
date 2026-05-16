import type { PoiCandidate } from '@/lib/poi'

export function poiPracticeKey(c: Pick<PoiCandidate, 'poi_source' | 'poi_id'>) {
  return `${c.poi_source}:${c.poi_id}`
}
