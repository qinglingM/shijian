import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { CityRow } from '@/lib/db'
import { dedupeTwinPrefectureCityRows } from '@/features/city-picker/cityRowDedupe'

function isMissingNamePinyinColumn(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message)
      : String(err)
  return /name_pinyin/i.test(msg) && (/does not exist/i.test(msg) || /42703/i.test(msg))
}

/**
 * 优先按 name_pinyin（迁移 0008）；若线上尚未执行该迁移，回退为旧列查询，避免城市列表完全失败。
 */
async function fetchCitiesRows(): Promise<CityRow[]> {
  const supabase = getSupabase()

  const preferred = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .order('name_pinyin', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .limit(5000)

  if (!preferred.error) {
    return dedupeTwinPrefectureCityRows((preferred.data ?? []) as CityRow[])
  }

  if (!isMissingNamePinyinColumn(preferred.error)) {
    throw preferred.error
  }

  const legacy = await supabase
    .from('cities')
    .select('id, name, province_name, sort_order, is_active, created_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(5000)

  if (legacy.error) throw legacy.error

  const rows = legacy.data ?? []
  return dedupeTwinPrefectureCityRows(
    rows.map((r) => ({
      ...r,
      name_pinyin: null,
    })) as CityRow[],
  )
}

export function useCities() {
  return useQuery<CityRow[]>({
    queryKey: ['cities', 'with-legacy-fallback'],
    enabled: isSupabaseConfigured,
    queryFn: fetchCitiesRows,
  })
}
