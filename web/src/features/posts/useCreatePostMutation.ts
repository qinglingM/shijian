import { useMutation } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useCreatePostMutation() {
  const uid = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: async (vars: {
      title: string
      content: string
      cover_image_url: string | null
      post_type: 'article'
    }) => {
      if (!isSupabaseConfigured) throw new Error('暂无可用后端')
      if (!uid) throw new Error('请先登录')
      const sb = getSupabase()
      const { data, error } = await sb
        .from('posts')
        .insert({
          user_id: uid,
          post_type: vars.post_type,
          title: vars.title,
          content: vars.content,
          cover_image_url: vars.cover_image_url,
          is_public: true,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
  })
}
