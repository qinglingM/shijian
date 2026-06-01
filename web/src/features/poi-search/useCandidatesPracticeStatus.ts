import { useQuery } from '@tanstack/react-query'

import { poiPracticeKey } from '@/features/poi-search/poiPracticeKey'
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
    gcTime: 0,
    // 返回 string[] 而非 Set：React Query 缓存会被 JSON 持久化到 localStorage，
    // Set 经 JSON.stringify 会变成 {}，重启 App 恢复后调用 .has 会崩溃。数组可安全序列化。
    queryFn: async (): Promise<string[]> => {
      if (!userId || candidates.length === 0) return []

      const poiKeysPracticed: string[] = []
      const poiToRestaurant = new Map<string, string>()

      const source = candidates[0].poi_source
      const ids = candidates.map((c) => c.poi_id)
      const supabase = getSupabase()
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id, poi_id')
        .eq('poi_source', source)
        .eq('status', 'active')
        .in('poi_id', ids)
      for (const r of (existing ?? []) as Array<{ id: string; poi_id: string }>) {
        const poi = candidates.find((c) => c.poi_id === r.poi_id)
        if (poi) poiToRestaurant.set(poiPracticeKey(poi), r.id)
      }

      const rids = [...new Set([...poiToRestaurant.values()])]
      if (rids.length === 0) return poiKeysPracticed

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
        if (practicedRids.has(rid)) poiKeysPracticed.push(pKey)
      }

      return poiKeysPracticed
    },
  })
}
