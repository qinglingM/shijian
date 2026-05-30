import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { RestaurantMarkUiStatus } from './useRestaurantMarkStatus'
import type { PoiCandidate } from '@/lib/poi'

export function useMarkPoiMutation(poi: PoiCandidate | null) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('未配置 Supabase')
      if (!uid) throw new Error('请先登录')
      if (!poi) throw new Error('缺少门店信息')
      
      const sb = getSupabase()
      
      const { data, error } = await sb.rpc('mark_poi_restaurant', {
        p_poi_source: poi.poi_source,
        p_poi_id: poi.poi_id,
        p_display_name: poi.poi_name,
        p_address_text: poi.address_text || null,
        p_location_hint: null,
        p_latitude: poi.latitude || null,
        p_longitude: poi.longitude || null,
        p_city_name: poi.city_name || null,
        p_district_name: poi.district_name || null,
        p_category_name: poi.category || poi.display_label || null,
        p_cover_image_url: poi.cover_image_url || null,
      })
      
      if (error) throw error
      if (!data) throw new Error('标记失败：服务端没有返回结果')
      return data as string
    },
    onSuccess(newRestaurantId) {
      if (!uid) return
      qc.invalidateQueries({ queryKey: ['restaurant-mark-status', uid, newRestaurantId] })
      qc.invalidateQueries({ queryKey: ['my-marks-feed', uid] })
      qc.invalidateQueries({ queryKey: ['me-summary', uid] })
    },
  })
}

export function useInsertMarkMutation(restaurantId: string) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('未配置 Supabase')
      if (!uid) throw new Error('请先登录')
      const sb = getSupabase()
      const { error } = await sb.from('marks').insert({
        user_id: uid,
        restaurant_id: restaurantId,
      })
      if (error) throw error
    },
    onMutate: async () => {
      if (!uid) return
      const queryKey = ['restaurant-mark-status', uid, restaurantId]
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<RestaurantMarkUiStatus>(queryKey)
      qc.setQueryData<RestaurantMarkUiStatus>(queryKey, 'marked')
      return { previous, queryKey }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(context.queryKey, context.previous)
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) {
        qc.invalidateQueries({ queryKey: context.queryKey })
      }
      if (uid) {
        qc.invalidateQueries({ queryKey: ['my-marks-feed', uid] })
        qc.invalidateQueries({ queryKey: ['me-summary', uid] })
      }
    },
  })
}

export function useDeleteMarkMutation(restaurantId: string) {
  const qc = useQueryClient()
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('未配置 Supabase')
      if (!uid) throw new Error('请先登录')
      const sb = getSupabase()
      const { error } = await sb.from('marks').delete().match({
        user_id: uid,
        restaurant_id: restaurantId,
      })
      if (error) throw error
    },
    onMutate: async () => {
      if (!uid) return
      const queryKey = ['restaurant-mark-status', uid, restaurantId]
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<RestaurantMarkUiStatus>(queryKey)
      qc.setQueryData<RestaurantMarkUiStatus>(queryKey, 'fresh')
      return { previous, queryKey }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(context.queryKey, context.previous)
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) {
        qc.invalidateQueries({ queryKey: context.queryKey })
      }
      if (uid) {
        qc.invalidateQueries({ queryKey: ['my-marks-feed', uid] })
      }
    },
  })
}
