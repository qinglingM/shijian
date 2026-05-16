import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { CategoryRow } from '@/lib/db'

export function useCategories() {
  return useQuery<CategoryRow[]>({
    queryKey: ['categories'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
  })
}
