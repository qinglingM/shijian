import { useQuery } from '@tanstack/react-query'

import { poiPracticeKey } from '@/features/poi-search/poiPracticeKey'
import { lookupExistingRestaurantByPoi } from '@/features/poi-search/usePoiSearch'
import { getSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { PoiCandidate } from '@/lib/poi'

/**
 * POI 列表里在当前用户是否已经「写过食鉴」（库中已有门店 + practice_records）。
 * 用于 Step1 对勾按钮样式区分。
 */
export function useCandidatesPracticeStatus(candidates: PoiCandidate[]) {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const key =
    candidates.length === 0
      ? ''
      : candidates.map(poiPracticeKey).sort().join('\u241e')

  return useQuery({
    queryKey: ['practice-candidate-practiced', userId ?? '', key],
    enabled: !!userId && candidates.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set()

      const poiKeysPracticed = new Set<string>()
      const poiToRestaurant = new Map<string, string>()

      const chunkSize = 10
      for (let i = 0; i < candidates.length; i += chunkSize) {
        const chunk = candidates.slice(i, i + chunkSize)
        await Promise.all(
          chunk.map(async (c) => {
            try {
              const rid = await lookupExistingRestaurantByPoi(c.poi_source, c.poi_id)
              const k = poiPracticeKey(c)
              if (rid) poiToRestaurant.set(k, rid)
            } catch {
              /* 单条忽略 */
            }
          }),
        )
      }

      const rids = [...new Set([...poiToRestaurant.values()])]
      if (rids.length === 0) return poiKeysPracticed

      const supabase = getSupabase()
      const { data: prRows, error } = await supabase
        .from('practice_records')
        .select('restaurant_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('restaurant_id', rids)

      if (error) {
        console.warn('[shijian] useCandidatesPracticeStatus:', error.message)
        return poiKeysPracticed
      }

      const practicedRids = new Set((prRows ?? []).map((p) => p.restaurant_id as string))

      for (const [pKey, rid] of poiToRestaurant) {
        if (practicedRids.has(rid)) poiKeysPracticed.add(pKey)
      }

      return poiKeysPracticed
    },
  })
}
