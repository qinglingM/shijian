import type { Tier } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

import {
  buildSubmissionBaseline,
  type DishComparableRow,
  type PracticeSubmissionBaseline,
} from './practiceSubmissionBaseline'

export type HydratedDishInput = {
  dish_id: string | null
  name: string
  score: number | null
  comment: string
  image_url: string | null
  is_public: boolean
}

export type HydratePracticeDraftResult = {
  tier: Tier
  store_comment: string
  is_public: boolean
  dishes_payload: HydratedDishInput[]
  submission_baseline: PracticeSubmissionBaseline
}

type DishReviewRow = {
  dish_id: string
  score: number | null
  comment: string | null
  image_url: string | null
  is_public: boolean
  dishes:
    | { name: string }[]
    | { name: string }
    | null
}

/** 读出当前用户在该店的有效食鉴，用于回填定档区与第三步（并锁定提交基线为服务端快照） */
export async function fetchExistingPracticeHydration(
  userId: string,
  restaurantId: string,
): Promise<HydratePracticeDraftResult | null> {
  const supabase = getSupabase()

  const { data: pr, error: prErr } = await supabase
    .from('practice_records')
    .select('id, tier, store_comment, is_public, is_anonymous')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle()

  if (prErr || !pr) return null

  const pid = pr.id as string
  const tier = pr.tier as Tier

  const { data: rows, error: rvErr } = await supabase
    .from('dish_reviews')
    .select('dish_id, score, comment, image_url, is_public, dishes ( name )')
    .eq('practice_record_id', pid)
    .eq('is_active', true)

  if (rvErr) throw new Error(rvErr.message)

  const normalizedRows = (rows ?? []) as DishReviewRow[]

  const dishes_payload: HydratedDishInput[] = []
  const comparable: DishComparableRow[] = []

  for (const row of normalizedRows) {
    const dishJoin = row.dishes
    const joinedName = Array.isArray(dishJoin)
      ? (dishJoin[0]?.name ?? '')
      : typeof dishJoin === 'object' && dishJoin?.name != null
        ? dishJoin.name
        : ''

    const name = joinedName.trim() || '(未命名菜品)'
    const comment = (row.comment ?? '').trim()
    const image_url = typeof row.image_url === 'string' ? row.image_url.trim() || null : null

    dishes_payload.push({
      dish_id: row.dish_id,
      name,
      score: row.score,
      comment,
      image_url,
      is_public: row.is_public,
    })

    comparable.push({
      dish_id: row.dish_id,
      name,
      score: row.score,
      comment,
      image_ref: (image_url ?? '').trim(),
      is_public: row.is_public,
    })
  }

  const store_comment = (pr.store_comment as string | null | undefined)?.trim() ?? ''
  const is_public = !!(pr.is_public as boolean)

  const submission_baseline = buildSubmissionBaseline(tier, store_comment, comparable)

  return {
    tier,
    store_comment,
    is_public,
    dishes_payload,
    submission_baseline,
  }
}
