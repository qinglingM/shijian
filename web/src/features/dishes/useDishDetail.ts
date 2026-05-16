import { useQuery } from '@tanstack/react-query'
import type { DishRow } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export function useDishDetail(dishId: string | null) {
  return useQuery<DishRow | null>({
    queryKey: ['dish', dishId],
    enabled: isSupabaseConfigured && !!dishId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb.from('dishes').select('*').eq('id', dishId!).maybeSingle()
      if (error) throw error
      return data as DishRow | null
    },
  })
}
