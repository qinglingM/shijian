import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export function useTodayPracticeCount() {
  return useQuery<number>({
    queryKey: ['today-practice-count'],
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    gcTime: 0,
    queryFn: async () => {
      const sb = getSupabase()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count, error } = await sb
        .from('practice_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('is_active', true)
        .not('store_comment', 'is', null)
        .neq('store_comment', '')
        .gte('created_at', today.toISOString())
      if (error) throw error
      return count ?? 0
    },
  })
}
