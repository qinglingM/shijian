import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

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
    onSuccess() {
      if (!uid) return
      qc.invalidateQueries({ queryKey: ['restaurant-mark-status', uid, restaurantId] })
      qc.invalidateQueries({ queryKey: ['my-marks-feed', uid] })
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
    onSuccess() {
      if (!uid) return
      qc.invalidateQueries({ queryKey: ['restaurant-mark-status', uid, restaurantId] })
      qc.invalidateQueries({ queryKey: ['my-marks-feed', uid] })
    },
  })
}
