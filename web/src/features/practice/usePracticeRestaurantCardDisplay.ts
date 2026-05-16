import { useMemo } from 'react'
import { useRestaurant } from '@/features/restaurants/useRestaurant'
import { getDraftRestaurantDisplay, usePracticeDraft } from '@/stores/practiceDraft'

export type PracticeMergedRestaurantCardDisplay = NonNullable<
  ReturnType<typeof getDraftRestaurantDisplay>
>

/**
 * 草稿店卡展示： POI/m 手动上的封面优先与库内 `restaurants.cover_image_url` 合并（库里非空则覆盖）。
 */
export function usePracticeRestaurantCardDisplay(): PracticeMergedRestaurantCardDisplay | null {
  const draft = usePracticeDraft()
  const base = getDraftRestaurantDisplay(draft)
  const rid = draft.existing_restaurant_id
  const q = useRestaurant(rid)

  return useMemo(() => {
    if (!base) return null
    const dbUrl = rid ? (q.data?.cover_image_url?.trim() || null) : null
    const localUrl = base.cover_image_url?.trim() || null
    const cover_image_url =
      dbUrl && dbUrl.length > 0 ? dbUrl : localUrl && localUrl.length > 0 ? localUrl : null

    return { ...base, cover_image_url }
  }, [base, rid, q.data?.cover_image_url])
}
