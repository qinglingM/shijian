import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getPoiProvider, type PoiCandidate } from '@/lib/poi'
import { getSupabase } from '@/lib/supabase'

export const POI_PAGE_SIZE = 20

export function usePoiSearch(keyword: string, city?: string, enabled = true) {
  const trimmed = keyword.trim()
  return useQuery<PoiCandidate[]>({
    queryKey: ['poi-search', trimmed, city ?? ''],
    enabled: enabled && trimmed.length >= 1,
    staleTime: 60_000,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const provider = getPoiProvider()
      const { items } = await provider.search({ keyword: trimmed, city, signal })
      return items
    },
  })
}

/**
 * 分页搜索：每页 POI_PAGE_SIZE 条，上拉加载下一页。
 * 排序策略「每页各自由近及远」由调用方对每页 items 单独排序后再拼接，
 * 故此处保持服务端返回顺序，不跨页重排。
 */
export function usePoiSearchInfinite(keyword: string, city?: string, enabled = true) {
  const trimmed = keyword.trim()
  return useInfiniteQuery({
    queryKey: ['poi-search-infinite', trimmed, city ?? ''],
    enabled: enabled && trimmed.length >= 1,
    staleTime: 60_000,
    gcTime: 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const provider = getPoiProvider()
      return provider.search({
        keyword: trimmed,
        city,
        signal,
        page: pageParam,
        pageSize: POI_PAGE_SIZE,
      })
    },
    getNextPageParam: (_lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0)
      const total = allPages[0]?.total ?? 0
      return loaded < total ? allPages.length + 1 : undefined
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
