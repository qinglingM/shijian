import { useQuery } from '@tanstack/react-query'
import { getPoiProvider, type PoiCandidate } from '@/lib/poi'
import { getSupabase } from '@/lib/supabase'

export function usePoiSearch(keyword: string, city?: string, enabled = true) {
  const trimmed = keyword.trim()
  return useQuery<PoiCandidate[]>({
    queryKey: ['poi-search', trimmed, city ?? ''],
    enabled: enabled && trimmed.length >= 1,
    staleTime: 60_000,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const provider = getPoiProvider()
      return provider.search({ keyword: trimmed, city, signal })
    },
  })
}

/**
 * 查 POI 是否已经存在食鉴餐厅库。
 * 返回 restaurant.id（命中）或 null（未命中）。
 */
export async function lookupExistingRestaurantByPoi(
  poiSource: PoiCandidate['poi_source'],
  poiId: string,
): Promise<string | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('poi_source', poiSource)
    .eq('poi_id', poiId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) {
    console.warn('[shijian] lookupExistingRestaurantByPoi:', error.message)
    return null
  }
  return data?.id ?? null
}
