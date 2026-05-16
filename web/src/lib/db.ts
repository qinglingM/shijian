/**
 * 食鉴 P0 · 数据库类型
 *
 * 与 supabase/migrations 保持一致。
 * 后续如改 schema，需同步修改这里。
 *
 * 用法：
 *   const supabase = createClient<Database>(...)
 *   supabase.from('cities').select('*')   // 自动有 Row 类型推断
 */

// ----------------------------------------------------------------
// 枚举
// ----------------------------------------------------------------
export type Tier = 'boom' | 'hang' | 'top' | 'upper' | 'npc' | 'bad'
export type PoiSource = 'amap' | 'manual' | 'tencent' | 'baidu' | 'apple'
export type RestaurantStatus = 'active' | 'pending' | 'merged' | 'hidden'
export type DishStatus = 'active' | 'merged' | 'hidden'
export type VoteType = 'youpin' | 'yebang'
export type VoteTarget = 'store_review' | 'dish_review'
export type AliasSource = 'user' | 'merge' | 'system'
export type ImageTargetType = 'restaurant' | 'dish' | 'dish_review' | 'profile'
export type ImageStatus = 'active' | 'hidden' | 'deleted'
export type TitleRarity = 'common' | 'rare' | 'epic' | 'legendary'

export const TIER_ORDER: readonly Tier[] = [
  'boom',
  'hang',
  'top',
  'upper',
  'npc',
  'bad',
] as const

export const TIER_LABEL: Record<Tier, string> = {
  boom: '夯爆了',
  hang: '夯',
  top: '顶级',
  upper: '人上人',
  npc: 'NPC',
  bad: '拉完了',
}

// 配色 token，对应 src/index.css :root（实心 vs *-soft 分工见 index 注释）
export const TIER_COLOR_VAR: Record<Tier, string> = {
  boom: 'var(--color-tier-boom)',
  hang: 'var(--color-tier-hang)',
  top: 'var(--color-tier-top)',
  upper: 'var(--color-tier-upper)',
  npc: 'var(--color-tier-npc)',
  bad: 'var(--color-tier-bad)',
}

export const TIER_SOFT_VAR: Record<Tier, string> = {
  boom: 'var(--color-tier-boom-soft)',
  hang: 'var(--color-tier-hang-soft)',
  top: 'var(--color-tier-top-soft)',
  upper: 'var(--color-tier-upper-soft)',
  npc: 'var(--color-tier-npc-soft)',
  bad: 'var(--color-tier-bad-soft)',
}

/** 同行无封面店铺格：同档 hue，饱和度为满色的 40%（见 index.css `-slot`） */
export const TIER_SLOT_VAR: Record<Tier, string> = {
  boom: 'var(--color-tier-boom-slot)',
  hang: 'var(--color-tier-hang-slot)',
  top: 'var(--color-tier-top-slot)',
  upper: 'var(--color-tier-upper-slot)',
  npc: 'var(--color-tier-npc-slot)',
  bad: 'var(--color-tier-bad-slot)',
}

/**
 * 食鉴图色块等：黑体、黑色加重（如档位列汉字、占位角标等）
 */
export const TIER_BLOCK_TEXT_CLASS =
  'font-black text-neutral-950 [font-family:SimHei,STHeiti,"Heiti_SC","Microsoft_YaHei","PingFang_SC",sans-serif]'

// ----------------------------------------------------------------
// Row 类型
// ----------------------------------------------------------------
export interface CityRow {
  id: string
  name: string
  province_name: string | null
  sort_order: number
  /** 无声调空格分词拼音，便于搜索与城市列表 A–Z */
  name_pinyin: string | null
  is_active: boolean
  created_at: string
}

export interface DistrictRow {
  id: string
  city_id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface CategoryRow {
  id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface TitleRow {
  id: string
  name: string
  rarity: TitleRarity
  description: string | null
  icon_url: string | null
  unlock_rule: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export interface ProfileRow {
  id: string
  user_code: string
  nickname: string
  avatar_url: string | null
  bio: string | null
  /** unspecified | male | female | other | prefer_not_say */
  gender: string | null
  /** 黄道十二宫英文代号，见前台映射 */
  zodiac_sign: string | null
  hometown: string | null
  birth_date: string | null
  /** 绑定手机号；唯一；格式接短信网关后再统一 */
  phone: string | null
  /** 最近一次短信 OTP 成功时间 */
  phone_verified_at: string | null
  /** 研发预留邮箱注册时为 true，产品可不强制走手机号绑定 */
  phone_binding_exempt: boolean
  city_id: string | null
  district_id: string | null
  current_title_id: string | null
  created_at: string
  updated_at: string
}

export interface RestaurantRow {
  id: string
  poi_source: PoiSource
  poi_id: string | null
  poi_name: string | null
  brand_name: string
  branch_name: string | null
  display_name: string
  address_text: string | null
  location_hint: string | null
  latitude: number | null
  longitude: number | null
  province_name: string | null
  city_name: string | null
  district_name: string | null
  city_id: string | null
  district_id: string | null
  category_id: string | null
  cover_image_url: string | null
  created_by: string
  status: RestaurantStatus
  merged_to_id: string | null
  search_text: string | null
  created_at: string
  updated_at: string
}

export interface PracticeRecordRow {
  id: string
  user_id: string
  restaurant_id: string
  tier: Tier
  store_comment: string | null
  is_public: boolean
  is_valid_practice: boolean
  valid_practice_at: string | null
  created_from: string
  source_poi_payload: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DishRow {
  id: string
  restaurant_id: string
  name: string
  cover_image_url: string | null
  avg_score: number | null
  review_count: number
  top_comment: string | null
  youpin_count: number
  yebang_count: number
  created_by: string
  status: DishStatus
  merged_to_id: string | null
  created_at: string
  updated_at: string
}

export interface DishReviewRow {
  id: string
  practice_record_id: string
  dish_id: string
  score: number | null
  comment: string | null
  image_url: string | null
  is_public: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MarkRow {
  id: string
  user_id: string
  restaurant_id: string
  created_at: string
}

export interface BoleRecordRow {
  id: string
  user_id: string
  restaurant_id: string
  practice_record_id: string
  is_active: boolean
  awarded_at: string
}

export interface ReviewVoteRow {
  id: string
  user_id: string
  target_type: VoteTarget
  target_id: string
  vote_type: VoteType
  created_at: string
  updated_at: string
}

export interface GuidanceFeedbackRow {
  id: string
  user_id: string
  restaurant_id: string
  practice_record_id: string
  has_guidance: boolean
  created_at: string
  updated_at: string
}

export interface UserTitleRow {
  id: string
  user_id: string
  title_id: string
  is_equipped: boolean
  obtained_at: string
}

export interface RestaurantAliasRow {
  id: string
  restaurant_id: string
  alias_name: string
  source_type: AliasSource
  created_by: string | null
  created_at: string
}

export interface DishAliasRow {
  id: string
  dish_id: string
  alias_name: string
  source_type: AliasSource
  created_by: string | null
  created_at: string
}

export interface ImageAssetRow {
  id: string
  owner_id: string
  url: string
  bucket: string
  path: string
  mime_type: string | null
  size_bytes: number | null
  target_type: ImageTargetType | null
  target_id: string | null
  status: ImageStatus
  created_at: string
}
