import type { DishReviewFeedItem } from '@/features/dishes/useDishReviewsByDish'
import type { RestaurantDishReviewItem } from '@/features/restaurants/useRestaurantDishReviews'
import type { StoreReviewItem } from '@/features/restaurants/useStoreReviewsByRestaurant'

const ENABLE_REPORT_TEST_FIXTURES =
  !import.meta.env.PROD || import.meta.env.VITE_ENABLE_REPORT_TEST_FIXTURES === 'true'

const REPORT_TEST_IMAGE_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="24" fill="#fff7ed"/>
      <rect x="22" y="22" width="196" height="196" rx="18" fill="#fdba74"/>
      <circle cx="86" cy="86" r="22" fill="#ffffff" fill-opacity="0.9"/>
      <path d="M44 172 92 120l30 32 26-24 48 44H44Z" fill="#ffffff" fill-opacity="0.92"/>
      <text x="120" y="208" text-anchor="middle" font-size="20" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" fill="#7c2d12">举报测试图</text>
    </svg>`,
  )

const STORE_FIXTURE_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const

const DISH_FIXTURE_IDS = [
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
] as const

export function withStoreReviewTestFixtures(list: StoreReviewItem[]): StoreReviewItem[] {
  if (!ENABLE_REPORT_TEST_FIXTURES || list.length === 0) return list
  const base = list[0]
  const fixtures: StoreReviewItem[] = [
    {
      ...base,
      id: STORE_FIXTURE_IDS[0],
      user_id: 'fixture-user-a',
      nickname: '测试路人甲',
      titleName: null,
      titleRarity: null,
      tier: 'boom',
      store_comment: '这家店是我随手乱写的一条测试店评，用来验证举报后折叠是否正常。',
      created_at: '2026-07-08T19:35:00+08:00',
      youpin_count: 6,
      yebang_count: 1,
      my_vote: null,
    },
    {
      ...base,
      id: STORE_FIXTURE_IDS[1],
      user_id: 'fixture-user-b',
      nickname: '测试路人乙',
      titleName: '食鉴新生',
      titleRarity: 'common',
      tier: 'npc',
      store_comment: '这条也是假的，主要拿来测店铺评价的举报入口、隐藏占位和返回行为。',
      created_at: '2026-07-08T19:28:00+08:00',
      youpin_count: 2,
      yebang_count: 0,
      my_vote: null,
    },
    {
      ...base,
      id: STORE_FIXTURE_IDS[2],
      user_id: 'fixture-user-c',
      nickname: '测试路人丙',
      titleName: null,
      titleRarity: null,
      tier: 'bad',
      store_comment: '纯测试内容：如果你在这里点举报，应该只影响这一条，而不是整家店。',
      created_at: '2026-07-08T19:20:00+08:00',
      youpin_count: 0,
      yebang_count: 3,
      my_vote: null,
    },
  ]
  return [...fixtures, ...list]
}

export function withRestaurantDishReviewTestFixtures(list: RestaurantDishReviewItem[]): RestaurantDishReviewItem[] {
  if (!ENABLE_REPORT_TEST_FIXTURES || list.length === 0) return list
  const base = list[0]
  const fixtures: RestaurantDishReviewItem[] = [
    {
      ...base,
      id: DISH_FIXTURE_IDS[0],
      reviewer_nickname: '测试吃客甲',
      titleName: '食鉴新生',
      titleRarity: 'common',
      score: 9,
      comment: '假菜评一：主要验证菜评举报、返回关闭、以及图片与文字的区分流程。',
      image_url: REPORT_TEST_IMAGE_DATA_URL,
      created_at: '2026-07-08T19:36:00+08:00',
      youpin_count: 5,
      yebang_count: 0,
      my_vote: null,
    },
    {
      ...base,
      id: DISH_FIXTURE_IDS[1],
      reviewer_nickname: '测试吃客乙',
      titleName: null,
      titleRarity: null,
      score: 4,
      comment: '假菜评二：这条不带图，用来确认只有一个举报入口，进入弹窗后再选对象。',
      image_url: null,
      created_at: '2026-07-08T19:32:00+08:00',
      youpin_count: 1,
      yebang_count: 1,
      my_vote: null,
    },
    {
      ...base,
      id: DISH_FIXTURE_IDS[2],
      reviewer_nickname: '测试吃客丙',
      titleName: null,
      titleRarity: null,
      score: 7,
      comment: '假菜评三：点右上角举报后，不应该再意外跳去菜品详情。',
      image_url: REPORT_TEST_IMAGE_DATA_URL,
      created_at: '2026-07-08T19:24:00+08:00',
      youpin_count: 3,
      yebang_count: 0,
      my_vote: null,
    },
  ]
  return [...fixtures, ...list]
}

export function withDishReviewTestFixtures(list: DishReviewFeedItem[]): DishReviewFeedItem[] {
  if (!ENABLE_REPORT_TEST_FIXTURES || list.length === 0) return list
  const base = list[0]
  const fixtures: DishReviewFeedItem[] = [
    {
      ...base,
      id: DISH_FIXTURE_IDS[0],
      reviewer_nickname: '测试吃客甲',
      score: 9,
      comment: '假菜评一：主要验证菜评举报、返回关闭、以及图片与文字的区分流程。',
      image_url: REPORT_TEST_IMAGE_DATA_URL,
      created_at: '2026-07-08T19:36:00+08:00',
      youpin_count: 5,
      yebang_count: 0,
      my_vote: null,
    },
    {
      ...base,
      id: DISH_FIXTURE_IDS[1],
      reviewer_nickname: '测试吃客乙',
      score: 4,
      comment: '假菜评二：这条不带图，用来确认只有一个举报入口，进入弹窗后再选对象。',
      image_url: null,
      created_at: '2026-07-08T19:32:00+08:00',
      youpin_count: 1,
      yebang_count: 1,
      my_vote: null,
    },
    {
      ...base,
      id: DISH_FIXTURE_IDS[2],
      reviewer_nickname: '测试吃客丙',
      score: 7,
      comment: '假菜评三：点右上角举报后，不应该再意外跳去菜品详情。',
      image_url: REPORT_TEST_IMAGE_DATA_URL,
      created_at: '2026-07-08T19:24:00+08:00',
      youpin_count: 3,
      yebang_count: 0,
      my_vote: null,
    },
  ]
  return [...fixtures, ...list]
}
