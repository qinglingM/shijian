import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

export function useProfilePrivacyMutation(userId: string | null) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (isProfilePublic: boolean) => {
      if (!userId) throw new Error('缺少用户 id')
      const sb = getSupabase()
      const { error } = await sb.from('profiles').update({ is_profile_public: isProfilePublic }).eq('id', userId)
      if (error) throw error
      return isProfilePublic
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me-summary', userId] })
      await qc.invalidateQueries({ queryKey: ['me-profile-edit', userId] })
      await qc.invalidateQueries({ queryKey: ['user-profile', userId] })
    },
  })
}
