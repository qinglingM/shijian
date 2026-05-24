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

interface SelectedPoi {
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
  amap_type_code?: string | null
  amap_mid_category?: string | null
  amap_small_category?: string | null
  display_label?: string | null
}

interface SubmitPayload {
  existing_restaurant_id: string | null
  selected_poi: SelectedPoi | null
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
      await recomputeDishAggregates(admin, dishId)
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
  for (const d of payload.dishes) {
    if (d.name.trim().length > 16) {
      throw new Error(`菜品「${d.name.trim()}」名称过长，最多 16 个字`)
    }
  }
}

async function resolveCityIdByName(
  admin: ReturnType<typeof createClient>,
  cityName: string | null | undefined,
): Promise<string | null> {
  const name = typeof cityName === 'string' ? cityName.trim() : ''
  if (!name) return null

  const { data, error } = await admin
    .from('cities')
    .select('id, name, province_name')
    .eq('is_active', true)
    .or(`name.eq.${name},province_name.eq.${name}`)
    .limit(50)

  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; name: string; province_name: string | null }>
  if (rows.length === 0) return null

  const exact = rows.find((r) => r.name === name)
  if (exact) return exact.id

  return rows[0]?.id ?? null
}

function extractCityNameFromPoi(poi: SubmitPayload['selected_poi']): string | null {
  if (!poi) return null
  return [poi.city_name, poi.province_name].find((v) => typeof v === 'string' && v.trim())?.trim() ?? null
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

function removeBracketContent(name: string): string {
  return name
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
}

interface ShijianMapping {
  categoryName: string
  subcategoryName: string
  displayLabel: string
}

const BRAND_MAPPING: Record<string, ShijianMapping> = {
  '快餐厅:麦当劳': { categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡' },
  '快餐厅:肯德基': { categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡' },
  '快餐厅:汉堡王': { categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡' },
  '快餐厅:德克士': { categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡' },
  '快餐厅:华莱士': { categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡' },
  '快餐厅:必胜客': { categoryName: '西餐', subcategoryName: '披萨', displayLabel: '披萨' },
  '快餐厅:吉野家': { categoryName: '小吃快餐', subcategoryName: '日式快餐', displayLabel: '日式快餐' },
  '快餐厅:永和豆浆': { categoryName: '小吃快餐', subcategoryName: '中式快餐', displayLabel: '中式快餐' },
  '快餐厅:大家乐': { categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐' },
  '快餐厅:大快活': { categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐' },
  '快餐厅:茶餐厅': { categoryName: '小吃快餐', subcategoryName: '茶餐厅', displayLabel: '茶餐厅' },
  '快餐厅:美心': { categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐' },
  '快餐厅:仙跡岩': { categoryName: '咖啡茶饮', subcategoryName: '茶饮', displayLabel: '茶饮' },
  '快餐厅:呷哺呷哺': { categoryName: '火锅烧烤', subcategoryName: '火锅', displayLabel: '火锅' },
  '咖啡厅:星巴克咖啡': { categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡' },
  '咖啡厅:上岛咖啡': { categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡' },
  '咖啡厅:Pacific Coffee Company': { categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡' },
  '咖啡厅:巴黎咖啡店': { categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡' },
}

const MID_FALLBACK: Record<string, ShijianMapping> = {
  '中餐厅': { categoryName: '中餐', subcategoryName: '综合中餐', displayLabel: '综合中餐' },
  '外国餐厅': { categoryName: '西餐', subcategoryName: '西餐', displayLabel: '西餐' },
  '快餐厅': { categoryName: '小吃快餐', subcategoryName: '快餐', displayLabel: '快餐' },
  '休闲餐饮场所': { categoryName: '其他餐饮', subcategoryName: '休闲餐饮', displayLabel: '休闲餐饮' },
  '咖啡厅': { categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡' },
  '茶艺馆': { categoryName: '咖啡茶饮', subcategoryName: '茶馆', displayLabel: '茶馆' },
  '冷饮店': { categoryName: '咖啡茶饮', subcategoryName: '冷饮', displayLabel: '冷饮' },
  '糕饼店': { categoryName: '甜品面包', subcategoryName: '面包烘焙', displayLabel: '面包烘焙' },
  '甜品店': { categoryName: '甜品面包', subcategoryName: '甜品', displayLabel: '甜品' },
  '餐饮相关场所': { categoryName: '其他餐饮', subcategoryName: '餐饮相关场所', displayLabel: '餐饮相关场所' },
}

const EXACT_MAPPING: Record<string, { mid: string; sub: string; result: ShijianMapping }> = {
  // 中餐厅
  '中餐厅:综合酒楼': { mid: '中餐厅', sub: '综合酒楼', result: { categoryName: '中餐', subcategoryName: '综合酒楼', displayLabel: '综合酒楼' } },
  '中餐厅:四川菜(川菜)': { mid: '中餐厅', sub: '四川菜(川菜)', result: { categoryName: '中餐', subcategoryName: '四川菜', displayLabel: '四川菜' } },
  '中餐厅:广东菜(粤菜)': { mid: '中餐厅', sub: '广东菜(粤菜)', result: { categoryName: '中餐', subcategoryName: '广东菜', displayLabel: '广东菜' } },
  '中餐厅:山东菜(鲁菜)': { mid: '中餐厅', sub: '山东菜(鲁菜)', result: { categoryName: '中餐', subcategoryName: '山东菜', displayLabel: '山东菜' } },
  '中餐厅:江苏菜': { mid: '中餐厅', sub: '江苏菜', result: { categoryName: '中餐', subcategoryName: '江苏菜', displayLabel: '江苏菜' } },
  '中餐厅:浙江菜': { mid: '中餐厅', sub: '浙江菜', result: { categoryName: '中餐', subcategoryName: '浙江菜', displayLabel: '浙江菜' } },
  '中餐厅:上海菜': { mid: '中餐厅', sub: '上海菜', result: { categoryName: '中餐', subcategoryName: '上海菜', displayLabel: '上海菜' } },
  '中餐厅:湖南菜(湘菜)': { mid: '中餐厅', sub: '湖南菜(湘菜)', result: { categoryName: '中餐', subcategoryName: '湖南菜', displayLabel: '湖南菜' } },
  '中餐厅:安徽菜(徽菜)': { mid: '中餐厅', sub: '安徽菜(徽菜)', result: { categoryName: '中餐', subcategoryName: '安徽菜', displayLabel: '安徽菜' } },
  '中餐厅:福建菜': { mid: '中餐厅', sub: '福建菜', result: { categoryName: '中餐', subcategoryName: '福建菜', displayLabel: '福建菜' } },
  '中餐厅:北京菜': { mid: '中餐厅', sub: '北京菜', result: { categoryName: '中餐', subcategoryName: '北京菜', displayLabel: '北京菜' } },
  '中餐厅:湖北菜(鄂菜)': { mid: '中餐厅', sub: '湖北菜(鄂菜)', result: { categoryName: '中餐', subcategoryName: '湖北菜', displayLabel: '湖北菜' } },
  '中餐厅:东北菜': { mid: '中餐厅', sub: '东北菜', result: { categoryName: '中餐', subcategoryName: '东北菜', displayLabel: '东北菜' } },
  '中餐厅:云贵菜': { mid: '中餐厅', sub: '云贵菜', result: { categoryName: '中餐', subcategoryName: '云贵菜', displayLabel: '云贵菜' } },
  '中餐厅:西北菜': { mid: '中餐厅', sub: '西北菜', result: { categoryName: '中餐', subcategoryName: '西北菜', displayLabel: '西北菜' } },
  '中餐厅:老字号': { mid: '中餐厅', sub: '老字号', result: { categoryName: '中餐', subcategoryName: '老字号', displayLabel: '老字号' } },
  '中餐厅:海鲜酒楼': { mid: '中餐厅', sub: '海鲜酒楼', result: { categoryName: '中餐', subcategoryName: '海鲜', displayLabel: '海鲜' } },
  '中餐厅:中式素菜馆': { mid: '中餐厅', sub: '中式素菜馆', result: { categoryName: '中餐', subcategoryName: '素食', displayLabel: '素食' } },
  '中餐厅:清真菜馆': { mid: '中餐厅', sub: '清真菜馆', result: { categoryName: '中餐', subcategoryName: '清真菜馆', displayLabel: '清真菜馆' } },
  '中餐厅:台湾菜': { mid: '中餐厅', sub: '台湾菜', result: { categoryName: '中餐', subcategoryName: '台湾菜', displayLabel: '台湾菜' } },
  '中餐厅:潮州菜': { mid: '中餐厅', sub: '潮州菜', result: { categoryName: '中餐', subcategoryName: '潮州菜', displayLabel: '潮州菜' } },
  '中餐厅:火锅店': { mid: '中餐厅', sub: '火锅店', result: { categoryName: '火锅烧烤', subcategoryName: '火锅', displayLabel: '火锅' } },
  // 外国餐厅
  '外国餐厅:西餐厅(综合风味)': { mid: '外国餐厅', sub: '西餐厅(综合风味)', result: { categoryName: '西餐', subcategoryName: '西餐', displayLabel: '西餐' } },
  '外国餐厅:日本料理': { mid: '外国餐厅', sub: '日本料理', result: { categoryName: '日韩料理', subcategoryName: '日本料理', displayLabel: '日本料理' } },
  '外国餐厅:韩国料理': { mid: '外国餐厅', sub: '韩国料理', result: { categoryName: '日韩料理', subcategoryName: '韩国料理', displayLabel: '韩国料理' } },
  '外国餐厅:法式菜品餐厅': { mid: '外国餐厅', sub: '法式菜品餐厅', result: { categoryName: '西餐', subcategoryName: '法国菜', displayLabel: '法国菜' } },
  '外国餐厅:意式菜品餐厅': { mid: '外国餐厅', sub: '意式菜品餐厅', result: { categoryName: '西餐', subcategoryName: '意大利菜', displayLabel: '意大利菜' } },
  '外国餐厅:泰国/越南菜品餐厅': { mid: '外国餐厅', sub: '泰国/越南菜品餐厅', result: { categoryName: '东南亚菜', subcategoryName: '泰越菜', displayLabel: '泰越菜' } },
  '外国餐厅:地中海风格菜品': { mid: '外国餐厅', sub: '地中海风格菜品', result: { categoryName: '西餐', subcategoryName: '地中海菜', displayLabel: '地中海菜' } },
  '外国餐厅:美式风味': { mid: '外国餐厅', sub: '美式风味', result: { categoryName: '西餐', subcategoryName: '美式餐厅', displayLabel: '美式餐厅' } },
  '外国餐厅:印度风味': { mid: '外国餐厅', sub: '印度风味', result: { categoryName: '东南亚菜', subcategoryName: '印度菜', displayLabel: '印度菜' } },
  '外国餐厅:英国式菜品餐厅': { mid: '外国餐厅', sub: '英国式菜品餐厅', result: { categoryName: '西餐', subcategoryName: '英国菜', displayLabel: '英国菜' } },
  '外国餐厅:牛扒店(扒房)': { mid: '外国餐厅', sub: '牛扒店(扒房)', result: { categoryName: '西餐', subcategoryName: '牛排', displayLabel: '牛排' } },
  '外国餐厅:俄国菜': { mid: '外国餐厅', sub: '俄国菜', result: { categoryName: '西餐', subcategoryName: '俄国菜', displayLabel: '俄国菜' } },
  '外国餐厅:葡国菜': { mid: '外国餐厅', sub: '葡国菜', result: { categoryName: '西餐', subcategoryName: '葡国菜', displayLabel: '葡国菜' } },
  '外国餐厅:德国菜': { mid: '外国餐厅', sub: '德国菜', result: { categoryName: '西餐', subcategoryName: '德国菜', displayLabel: '德国菜' } },
  '外国餐厅:巴西菜': { mid: '外国餐厅', sub: '巴西菜', result: { categoryName: '西餐', subcategoryName: '巴西菜', displayLabel: '巴西菜' } },
  '外国餐厅:墨西哥菜': { mid: '外国餐厅', sub: '墨西哥菜', result: { categoryName: '西餐', subcategoryName: '墨西哥菜', displayLabel: '墨西哥菜' } },
  '外国餐厅:其它亚洲菜': { mid: '外国餐厅', sub: '其它亚洲菜', result: { categoryName: '东南亚菜', subcategoryName: '亚洲菜', displayLabel: '亚洲菜' } },
}

function mapAmapToShijian(
  amapType: string | null | undefined,
  poiName: string,
): ShijianMapping {
  if (!amapType) {
    return { categoryName: '其他餐饮', subcategoryName: '其他餐饮', displayLabel: '其他餐饮' }
  }

  const segs = amapType.split(';').map((s) => s.trim())
  const midText = segs[1] ?? segs[0] ?? ''
  const subText = segs[2] ?? segs[1] ?? segs[0] ?? ''

  if (!midText && !subText) {
    return { categoryName: '其他餐饮', subcategoryName: '其他餐饮', displayLabel: '其他餐饮' }
  }

  // 1. Brand mapping
  const brandKey = `${midText}:${subText}`
  if (BRAND_MAPPING[brandKey]) {
    return BRAND_MAPPING[brandKey]
  }

  // 2. Keyword mapping for 特色/地方风味餐厅
  if (midText === '中餐厅' && subText === '特色/地方风味餐厅') {
    if (/烧烤|烤肉|烤串|串/.test(poiName)) {
      return { categoryName: '火锅烧烤', subcategoryName: '烧烤', displayLabel: '烧烤' }
    }
    if (/粉|面|米线|螺蛳/.test(poiName)) {
      return { categoryName: '小吃快餐', subcategoryName: '粉面', displayLabel: '粉面' }
    }
    return { categoryName: '中餐', subcategoryName: '地方风味', displayLabel: '地方风味' }
  }

  // 3. Exact mapping
  const exactKey = `${midText}:${subText}`
  if (EXACT_MAPPING[exactKey]) {
    return EXACT_MAPPING[exactKey].result
  }

  // 4. Try cleaned sub match
  const cleanedSub = removeBracketContent(subText)
  for (const key of Object.keys(EXACT_MAPPING)) {
    const rule = EXACT_MAPPING[key]
    if (rule.mid === midText) {
      const cleaned = removeBracketContent(rule.sub)
      if (cleaned === cleanedSub) {
        return rule.result
      }
    }
  }

  // 5. Mid fallback
  if (MID_FALLBACK[midText]) {
    return MID_FALLBACK[midText]
  }

  return { categoryName: '其他餐饮', subcategoryName: '其他餐饮', displayLabel: '其他餐饮' }
}

async function resolveCategoryIdByName(
  admin: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  if (!name) return null
  const { data } = await admin.from('categories').select('id').eq('name', name).maybeSingle()
  return data?.id ?? null
}

async function resolveSubcategoryIdByName(
  admin: ReturnType<typeof createClient>,
  name: string,
  categoryId: string,
): Promise<string | null> {
  if (!name) return null
  const { data } = await admin
    .from('subcategories')
    .select('id')
    .eq('name', name)
    .eq('category_id', categoryId)
    .maybeSingle()
  return data?.id ?? null
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
      const { error: activateError } = await admin
        .from('restaurants')
        .update({
          status: 'active',
          discovered_from: 'practice',
        })
        .eq('id', existing.id)
      if (activateError) throw activateError
      return existing.id
    }

    const displayName = poi.poi_name.trim()
    const cityName = extractCityNameFromPoi(poi)
    const cityId = await resolveCityIdByName(admin, cityName)

    // 新双层分类映射
    const amapType = [poi.amap_mid_category, poi.amap_small_category].filter(Boolean).join(';')
    const mapping = mapAmapToShijian(amapType || null, displayName)
    const categoryId = await resolveCategoryIdByName(admin, mapping.categoryName)
    const subcategoryId = categoryId
      ? await resolveSubcategoryIdByName(admin, mapping.subcategoryName, categoryId)
      : null

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
        city_id: cityId,
        district_name: poi.district_name,
        cover_image_url: poi.cover_image_url?.trim() || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        display_category_label: mapping.displayLabel,
        amap_type_code: poi.amap_type_code ?? null,
        amap_mid_category: poi.amap_mid_category ?? null,
        amap_small_category: poi.amap_small_category ?? null,
        created_by: userId,
        status: 'active',
        discovered_from: 'practice',
        search_text: [displayName, poi.address_text, poi.district_name, mapping.displayLabel]
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

  // 手动录入：取前端传入的 category_id / category_name 映射小类
  let subcategoryId: string | null = null
  let displayLabel: string | null = null
  if (manual.category_id && manual.category_name) {
    displayLabel = manual.category_name
    const { data: sub } = await admin
      .from('subcategories')
      .select('id')
      .eq('name', manual.category_name)
      .eq('category_id', manual.category_id)
      .maybeSingle()
    subcategoryId = sub?.id ?? null
  }

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
      subcategory_id: subcategoryId,
      display_category_label: displayLabel,
      cover_image_url: manual.cover_image_url,
      created_by: userId,
      status: 'active',
      discovered_from: 'manual',
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

async function recomputeDishAggregates(
  admin: ReturnType<typeof createClient>,
  dishId: string,
) {
  const { data } = await admin
    .from('dish_reviews')
    .select('score')
    .eq('dish_id', dishId)
    .eq('is_active', true)

  const rows = (data ?? []) as { score: number | null }[]
  const scores = rows.map((r) => r.score).filter((s): s is number => s !== null)
  const avg =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null

  const { error } = await admin
    .from('dishes')
    .update({ avg_score: avg, review_count: rows.length })
    .eq('id', dishId)
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
