import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Tier = 'boom' | 'hang' | 'top' | 'upper' | 'npc' | 'bad'
type PoiSource = 'amap' | 'manual' | 'tencent' | 'baidu' | 'apple'

interface SubmitDish {
  dish_id: string | null
  name: string
  score: number | null
  comment: string
  image_url: string | null
  is_public: boolean
}

interface SubmitPayload {
  existing_restaurant_id: string | null
  selected_poi: {
    poi_source: PoiSource
    poi_id: string
    poi_name: string
    address_text: string
    latitude: number | null
    longitude: number | null
    province_name: string | null
    city_name: string | null
    district_name: string | null
    category: string | null
    cover_image_url: string | null
  } | null
  manual_restaurant: {
    brand_name: string
    city_id: string | null
    city_name: string
    district_id: string | null
    district_name: string | null
    location_hint: string | null
    address_text: string | null
    latitude: number | null
    longitude: number | null
    cover_image_url: string | null
    category_id: string | null
    category_name: string | null
  } | null
  tier: Tier
  store_comment: string
  is_public: boolean
  good_review_guidance: boolean
  dishes: SubmitDish[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: '只支持 POST' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: '请先登录后再提交食鉴' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const payload = (await req.json()) as SubmitPayload
    validatePayload(payload)

    const userId = userData.user.id
    const restaurantId = await resolveRestaurant(admin, userId, payload)
    /** 有效实践：完成餐厅六档评定即可，不强制附带菜品评测 */
    const validPractice = true

    const practiceRecord = await upsertPracticeRecord(
      admin,
      userId,
      restaurantId,
      payload,
      validPractice,
    )

    await deactivateDishReviews(admin, practiceRecord.id)

    const dishReviewIds: string[] = []
    for (const dish of payload.dishes.filter((d) => d.name.trim() !== '')) {
      const dishId = await resolveDish(admin, userId, restaurantId, dish)
      const review = await upsertDishReview(admin, practiceRecord.id, dishId, dish)
      dishReviewIds.push(review.id)
    }

    if (validPractice) {
      await maybeAwardBole(admin, userId, restaurantId, practiceRecord.id)
      if (payload.good_review_guidance) {
        await upsertGuidanceFeedback(admin, userId, restaurantId, practiceRecord.id)
      }
    }

    return json({
      restaurant_id: restaurantId,
      practice_record_id: practiceRecord.id,
      dish_review_ids: dishReviewIds,
      is_valid_practice: validPractice,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '提交失败'
    return json({ error: message }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`缺少 Edge Function 环境变量：${name}`)
  return value
}

function validatePayload(payload: SubmitPayload) {
  if (!payload.tier) throw new Error('请选择档位')
  if (!payload.existing_restaurant_id && !payload.selected_poi && !payload.manual_restaurant) {
    throw new Error('缺少店铺信息')
  }
  if (payload.dishes.some((d) => d.name.trim() === '')) {
    throw new Error('存在未填写菜名的菜品，请补全或删除后再提交')
  }
}

/** 仅当库内封面仍为空时补图（搜索图 / 首提交流程） */
async function maybeMergeRestaurantCover(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  candidateUrl: string | null | undefined,
): Promise<void> {
  const t = typeof candidateUrl === 'string' ? candidateUrl.trim() : ''
  if (!t) return
  const { data: row, error } = await admin
    .from('restaurants')
    .select('cover_image_url')
    .eq('id', restaurantId)
    .maybeSingle()
  if (error || !row) return
  const cur = String((row as { cover_image_url?: string }).cover_image_url ?? '').trim()
  if (cur) return
  const { error: upErr } = await admin.from('restaurants').update({ cover_image_url: t }).eq('id', restaurantId)
  if (upErr) throw upErr
}

async function resolveRestaurant(
  admin: ReturnType<typeof createClient>,
  userId: string,
  payload: SubmitPayload,
): Promise<string> {
  if (payload.existing_restaurant_id) {
    await maybeMergeRestaurantCover(
      admin,
      payload.existing_restaurant_id,
      payload.selected_poi?.cover_image_url,
    )
    return payload.existing_restaurant_id
  }

  if (payload.selected_poi) {
    const poi = payload.selected_poi
    const { data: existing, error: existingError } = await admin
      .from('restaurants')
      .select('id')
      .eq('poi_source', poi.poi_source)
      .eq('poi_id', poi.poi_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.id) {
      await maybeMergeRestaurantCover(admin, existing.id, poi.cover_image_url ?? null)
      return existing.id
    }

    const displayName = poi.poi_name.trim()
    const { data, error } = await admin
      .from('restaurants')
      .insert({
        poi_source: poi.poi_source,
        poi_id: poi.poi_id,
        poi_name: poi.poi_name,
        brand_name: displayName,
        display_name: displayName,
        address_text: poi.address_text,
        latitude: poi.latitude,
        longitude: poi.longitude,
        province_name: poi.province_name,
        city_name: poi.city_name,
        district_name: poi.district_name,
        cover_image_url: poi.cover_image_url?.trim() || null,
        created_by: userId,
        status: 'active',
        search_text: [displayName, poi.address_text, poi.district_name, poi.category]
          .filter(Boolean)
          .join(' '),
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  const manual = payload.manual_restaurant!
  const displayName = manual.brand_name.trim()
  const { data, error } = await admin
    .from('restaurants')
    .insert({
      poi_source: 'manual',
      poi_id: null,
      poi_name: null,
      brand_name: displayName,
      display_name: displayName,
      address_text: manual.address_text,
      location_hint: manual.location_hint,
      latitude: manual.latitude,
      longitude: manual.longitude,
      city_name: manual.city_name,
      district_name: manual.district_name,
      city_id: manual.city_id,
      district_id: manual.district_id,
      category_id: manual.category_id,
      cover_image_url: manual.cover_image_url,
      created_by: userId,
      status: 'active',
      search_text: [
        displayName,
        manual.address_text,
        manual.location_hint,
        manual.city_name,
        manual.district_name,
        manual.category_name,
      ]
        .filter(Boolean)
        .join(' '),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function upsertPracticeRecord(
  admin: ReturnType<typeof createClient>,
  userId: string,
  restaurantId: string,
  payload: SubmitPayload,
  validPractice: boolean,
) {
  const practicePayload = {
    user_id: userId,
    restaurant_id: restaurantId,
    tier: payload.tier,
    store_comment: payload.store_comment.trim() || null,
    is_public: payload.is_public,
    is_valid_practice: validPractice,
    valid_practice_at: validPractice ? new Date().toISOString() : null,
    created_from: payload.existing_restaurant_id
      ? 'existing'
      : payload.selected_poi?.poi_source ?? 'manual',
    source_poi_payload: payload.selected_poi,
    is_active: true,
  }

  const { data: existing, error: existingError } = await admin
    .from('practice_records')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { data, error } = await admin
      .from('practice_records')
      .update(practicePayload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('practice_records')
    .insert(practicePayload)
    .select('id')
    .single()
  if (error) throw error
  return data
}

async function deactivateDishReviews(
  admin: ReturnType<typeof createClient>,
  practiceRecordId: string,
) {
  const { error } = await admin
    .from('dish_reviews')
    .update({ is_active: false })
    .eq('practice_record_id', practiceRecordId)
    .eq('is_active', true)
  if (error) throw error
}

async function resolveDish(
  admin: ReturnType<typeof createClient>,
  userId: string,
  restaurantId: string,
  dish: SubmitDish,
): Promise<string> {
  if (dish.dish_id) {
    const url = dish.image_url?.trim() ?? ''
    if (url) {
      const { data: drow } = await admin
        .from('dishes')
        .select('cover_image_url')
        .eq('id', dish.dish_id!)
        .maybeSingle()
      const cur = String((drow as { cover_image_url?: string } | null)?.cover_image_url ?? '').trim()
      if (!cur) {
        const { error: pu } = await admin
          .from('dishes')
          .update({ cover_image_url: url })
          .eq('id', dish.dish_id!)
        if (pu) throw pu
      }
    }
    return dish.dish_id
  }

  const { data: existing, error: existingError } = await admin
    .from('dishes')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('name', dish.name.trim())
    .eq('status', 'active')
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) return existing.id

  const { data, error } = await admin
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      name: dish.name.trim(),
      cover_image_url: dish.image_url,
      review_count: dish.score === null ? 0 : 1,
      avg_score: dish.score,
      top_comment: dish.comment.trim() || null,
      created_by: userId,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function upsertDishReview(
  admin: ReturnType<typeof createClient>,
  practiceRecordId: string,
  dishId: string,
  dish: SubmitDish,
) {
  const reviewPayload = {
    practice_record_id: practiceRecordId,
    dish_id: dishId,
    score: dish.score,
    comment: dish.comment.trim() || null,
    image_url: dish.image_url,
    is_public: dish.is_public,
    is_active: true,
  }

  const { data: existing, error: existingError } = await admin
    .from('dish_reviews')
    .select('id')
    .eq('practice_record_id', practiceRecordId)
    .eq('dish_id', dishId)
    .eq('is_active', true)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { data, error } = await admin
      .from('dish_reviews')
      .update(reviewPayload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('dish_reviews')
    .insert(reviewPayload)
    .select('id')
    .single()
  if (error) throw error
  return data
}

async function maybeAwardBole(
  admin: ReturnType<typeof createClient>,
  userId: string,
  restaurantId: string,
  practiceRecordId: string,
) {
  const { data: existing, error: existingError } = await admin
    .from('bole_records')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) return

  const { error } = await admin.from('bole_records').insert({
    user_id: userId,
    restaurant_id: restaurantId,
    practice_record_id: practiceRecordId,
    is_active: true,
  })
  if (error && error.code !== '23505') throw error
}

async function upsertGuidanceFeedback(
  admin: ReturnType<typeof createClient>,
  userId: string,
  restaurantId: string,
  practiceRecordId: string,
) {
  const { data: existing, error: existingError } = await admin
    .from('good_review_guidance_feedbacks')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { error } = await admin
      .from('good_review_guidance_feedbacks')
      .update({ has_guidance: true, practice_record_id: practiceRecordId })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await admin.from('good_review_guidance_feedbacks').insert({
    user_id: userId,
    restaurant_id: restaurantId,
    practice_record_id: practiceRecordId,
    has_guidance: true,
  })
  if (error) throw error
}
