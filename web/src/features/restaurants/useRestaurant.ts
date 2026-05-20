import { useQuery } from '@tanstack/react-query'
import type { PoiSource, RestaurantRow } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isRestaurantUuid(id: string) {
  return UUID_RE.test(id)
}

/** 前端详情视图：在主表基础上拼接分类中文名（若有关联） */
export type RestaurantDetail = RestaurantRow & { category_name: string | null }

export function useRestaurant(restaurantId: string | null) {
  return useQuery<RestaurantDetail | null>({
    queryKey: ['restaurant', restaurantId],
    enabled: isSupabaseConfigured && !!restaurantId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('restaurants')
        .select(
          `
          id,
          poi_source,
          poi_id,
          poi_name,
          brand_name,
          branch_name,
          display_name,
          address_text,
          location_hint,
          latitude,
          longitude,
          province_name,
          city_name,
          district_name,
          city_id,
          district_id,
          category_id,
          cover_image_url,
          created_by,
          status,
          merged_to_id,
          search_text,
          created_at,
          updated_at,
          display_category_label,
          categories(name)
        `,
        )
        .eq('id', restaurantId!)
        .maybeSingle()

      if (error) throw error
      const row = data as Record<string, unknown> | null
      if (!row) return null

      const nested = row.categories as { name?: string } | { name?: string }[] | null | undefined
      let category_name: string | null = null
      if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.name != null)
        category_name = String(nested.name)
      else if (Array.isArray(nested) && nested[0]?.name != null)
        category_name = String(nested[0].name)

      const { categories: _omit, ...core } = row
      void _omit

      const rest = core as unknown as RestaurantRow
      return {
        ...rest,
        poi_source: rest.poi_source as PoiSource,
        category_name,
      }
    },
  })
}
