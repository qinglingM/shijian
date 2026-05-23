import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PoiCandidate } from '@/lib/poi'
import type { Tier } from '@/lib/db'
import type { HydratePracticeDraftResult } from '@/features/practice/hydratePracticeDraftFromServer'
import type { PracticeSubmissionBaseline } from '@/features/practice/practiceSubmissionBaseline'
import { snapshotFromDraftLike } from '@/features/practice/practiceSubmissionBaseline'

/**
 * 用户在「食鉴流程三步」中尚未提交的草稿。
 * 提交成功后会被清空。
 */

export interface ManualRestaurantInfo {
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
}

export interface DraftDishReview {
  /** 客户端临时 id（uuid 风格） */
  client_id: string
  /** 已有菜品的 dish_id；若是新增菜品则为 null */
  dish_id: string | null
  /** 菜名 */
  name: string
  /** 0–10 分；null = 未打分 */
  score: number | null
  comment: string
  image_url: string | null
  is_public: boolean
}

interface PracticeDraftState {
  selected_poi: PoiCandidate | null
  manual_restaurant: ManualRestaurantInfo | null
  /** 已有的食鉴餐厅 id（POI 命中库时填入） */
  existing_restaurant_id: string | null

  /**
   * 当前用户在该店已有有效食鉴记录；提交 submit-practice 会更新而非新建第二条。
   * 在进入 step1 选店并由前端检测后写入。
   */
  will_replace_existing_practice: boolean

  tier: Tier | null
  store_comment: string
  /** 评价是否公开显示（始终为 true，因为评价总是公开的） */
  is_public: boolean

  dishes: DraftDishReview[]
  good_review_guidance: boolean

  /**
   * 第三步「是否与基线有差异」的比较对象。
   * 来自服务端 hydrate 或与进入第三步时快照。
   */
  submission_baseline: PracticeSubmissionBaseline | null

  /**
   * true：基线为服务端回填，不得在第三步首帧重写。
   */
  submission_baseline_locked_from_server: boolean

  /**
   * 提交成功后要跳回的页面路径（来源页）。null 则回 /map。
   */
  returnTo: string | null

  applyHydratedPracticeFromServer: (payload: HydratePracticeDraftResult) => void

  /**
   * 首次进入第三步时若为首次编辑（未锁服务端），用当前草稿建基线。
   */
  captureStep3SubmissionBaselineIfNeeded: () => void

  setPoi: (
    poi: PoiCandidate,
    existingRestaurantId: string | null,
    willReplaceExistingPractice?: boolean,
  ) => void
  setExistingRestaurant: (
    restaurant: {
      id: string
      display_name: string
      address_text: string | null
      location_hint: string | null
      latitude: number | null
      longitude: number | null
      city_id: string | null
      city_name: string | null
      district_id: string | null
      district_name: string | null
      cover_image_url: string | null
      category_id: string | null
      category_name: string | null
    },
    willReplaceExistingPractice?: boolean,
  ) => void
  setManual: (manual: ManualRestaurantInfo) => void
  setTier: (tier: Tier | null) => void
  setStoreComment: (text: string) => void
  setIsPublic: (v: boolean) => void
  addDish: (dish: Omit<DraftDishReview, 'client_id'>) => void
  updateDish: (clientId: string, patch: Partial<DraftDishReview>) => void
  removeDish: (clientId: string) => void
  setGoodReviewGuidance: (v: boolean) => void
  setReturnTo: (path: string | null) => void
  reset: () => void
}

const INITIAL = {
  selected_poi: null,
  manual_restaurant: null,
  existing_restaurant_id: null,
  will_replace_existing_practice: false,
  tier: null,
  store_comment: '',
  is_public: true,
  dishes: [] as DraftDishReview[],
  good_review_guidance: false,
  submission_baseline: null as PracticeSubmissionBaseline | null,
  submission_baseline_locked_from_server: false,

  returnTo: null as string | null,
}

function randomId() {
  // 不依赖 crypto.randomUUID 以兼容更老的环境
  return `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export const usePracticeDraft = create<PracticeDraftState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      applyHydratedPracticeFromServer: (payload: HydratePracticeDraftResult) =>
        set({
          tier: payload.tier,
          store_comment: payload.store_comment,
          is_public: payload.is_public,
          dishes: payload.dishes_payload.map((d) => ({ ...d, client_id: randomId() })),
          submission_baseline: payload.submission_baseline,
          submission_baseline_locked_from_server: true,
        }),
      captureStep3SubmissionBaselineIfNeeded: () => {
        const s = get()
        if (s.submission_baseline_locked_from_server) return
        if (s.submission_baseline !== null) return
        if (!s.tier) return
        const submission_baseline = snapshotFromDraftLike({
          tier: s.tier,
          store_comment: s.store_comment,
          is_public: s.is_public,
          dishes: s.dishes,
          submission_baseline: null,
        })
        set({
          submission_baseline,
        })
      },
      setPoi: (poi, existingRestaurantId, willReplaceExistingPractice = false) =>
        set({
          selected_poi: poi,
          manual_restaurant: null,
          existing_restaurant_id: existingRestaurantId,
          will_replace_existing_practice:
            !!existingRestaurantId && !!willReplaceExistingPractice,
          // 换店后必须重新定档，避免新店默认继承上一家店的位置。
          tier: null,
          store_comment: '',
          is_public: true,

          dishes: [],
          good_review_guidance: false,
          submission_baseline: null,
          submission_baseline_locked_from_server: false,
          returnTo: null,
        }),
      setExistingRestaurant: (restaurant, willReplaceExistingPractice = false) =>
        set({
          selected_poi: null,
          manual_restaurant: {
            brand_name: restaurant.display_name,
            city_id: restaurant.city_id,
            city_name: restaurant.city_name?.trim() || '',
            district_id: restaurant.district_id,
            district_name: restaurant.district_name,
            location_hint: restaurant.location_hint,
            address_text: restaurant.address_text,
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
            cover_image_url: restaurant.cover_image_url,
            category_id: restaurant.category_id,
            category_name: restaurant.category_name,
          },
          existing_restaurant_id: restaurant.id,
          will_replace_existing_practice: willReplaceExistingPractice,
          tier: null,
          store_comment: '',
          is_public: true,

          dishes: [],
          good_review_guidance: false,
          submission_baseline: null,
          submission_baseline_locked_from_server: false,
          returnTo: null,
        }),
      setManual: (manual) =>
        set({
          manual_restaurant: manual,
          selected_poi: null,
          existing_restaurant_id: null,
          will_replace_existing_practice: false,
          tier: null,
          store_comment: '',
          is_public: true,

          dishes: [],
          good_review_guidance: false,
          submission_baseline: null,
          submission_baseline_locked_from_server: false,
          returnTo: null,
        }),
      setTier: (tier) => set({ tier }),
      setStoreComment: (store_comment) => set({ store_comment }),
      setIsPublic: (is_public) => set({ is_public }),
      addDish: (dish) =>
        set((s) => ({
          dishes: [...s.dishes, { ...dish, client_id: randomId() }],
        })),
      updateDish: (clientId, patch) =>
        set((s) => ({
          dishes: s.dishes.map((d) =>
            d.client_id === clientId ? { ...d, ...patch } : d,
          ),
        })),
      removeDish: (clientId) =>
        set((s) => ({ dishes: s.dishes.filter((d) => d.client_id !== clientId) })),
      setGoodReviewGuidance: (good_review_guidance) => set({ good_review_guidance }),
      setReturnTo: (returnTo) => set({ returnTo }),
      reset: () => set({ ...INITIAL }),
    }),
    { name: 'shijian:practice-draft' },
  ),
)

/**
 * 列表中的每一道菜都必须有非空名称（占位行必须先填名或删除）。
 */
export function everyDishRowHasName(state: PracticeDraftState): boolean {
  return state.dishes.every((d) => d.name.trim() !== '')
}

/**
 * 只要菜品卡已存在，每一道菜都必须完成评分。
 */
export function everyDishRowHasScore(state: PracticeDraftState): boolean {
  return state.dishes.every((d) => d.score !== null)
}

/**
 * 是否允许提交食鉴第三步：有店 + 已订六档；若列出了菜品则每行须有菜名。
 * 有效实践的最小单元为「餐厅订档」；菜品评测为可选。
 */
export function isValidPractice(state: PracticeDraftState): boolean {
  const hasStore = !!state.selected_poi || !!state.manual_restaurant
  const hasTier = state.tier !== null
  const allNamed = everyDishRowHasName(state)
  const allScored = everyDishRowHasScore(state)
  return hasStore && hasTier && allNamed && allScored
}

export function getDraftRestaurantDisplay(state: PracticeDraftState): {
  brand_name: string
  category_name: string | null
  address_text: string | null
  city_name: string | null
  district_name: string | null
  cover_image_url: string | null
} | null {
  if (state.selected_poi) {
    return {
      brand_name: state.selected_poi.poi_name,
      category_name: state.selected_poi.display_label ?? state.selected_poi.category ?? null,
      address_text: state.selected_poi.address_text,
      city_name: state.selected_poi.city_name,
      district_name: state.selected_poi.district_name,
      cover_image_url: state.selected_poi.cover_image_url ?? null,
    }
  }
  if (state.manual_restaurant) {
    const m = state.manual_restaurant
    return {
      brand_name: m.brand_name,
      category_name: m.category_name?.trim() || null,
      address_text: m.address_text,
      city_name: m.city_name,
      district_name: m.district_name,
      cover_image_url: m.cover_image_url,
    }
  }
  return null
}
