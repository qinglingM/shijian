import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { DistrictRow } from '@/lib/db'

export function useDistricts(cityId: string | null) {
  return useQuery<DistrictRow[]>({
    queryKey: ['districts', cityId],
    enabled: isSupabaseConfigured && !!cityId,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('city_id', cityId!)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as DistrictRow[]
    },
  })
}
