import type { StoreReviewItem } from '@/features/restaurants/useStoreReviewsByRestaurant'
import type { Tier } from '@/lib/db'

export interface DemoRestaurantMeta {
  display_name: string
  cover_image_url: string | null
  tier: Tier
  category_name: string
  city_name?: string | null
  district_name?: string | null
  address_detail?: string | null
}

const DEMOS: Record<string, DemoRestaurantMeta> = {
  'demo-1': {
    display_name: '海底捞·紫竹桥',
    cover_image_url: null,
    tier: 'boom',
    category_name: '火锅',
    city_name: '北京',
    district_name: '海淀区',
    address_detail: '紫竹院路××号（示意）',
  },
  'demo-2': {
    display_name: '丰茂烤串',
    cover_image_url: null,
    tier: 'boom',
    category_name: '烧烤',
    city_name: '北京',
    district_name: '朝阳区',
  },
  'demo-3': {
    display_name: '南京大牌档',
    cover_image_url: null,
    tier: 'boom',
    category_name: '饭馆',
    city_name: '南京',
    district_name: '玄武区',
  },
  'demo-4': {
    display_name: '局气·三里屯',
    cover_image_url: null,
    tier: 'hang',
    category_name: '饭馆',
    city_name: '北京',
    district_name: '朝阳区',
  },
  'demo-5': {
    display_name: '喜茶',
    cover_image_url: null,
    tier: 'hang',
    category_name: '饮甜',
    city_name: '深圳',
    district_name: '南山区',
  },
  'demo-6': {
    display_name: '味千拉面',
    cover_image_url: null,
    tier: 'top',
    category_name: '粉面',
    city_name: '上海',
    district_name: '黄浦区',
  },
  'demo-7': {
    display_name: '隆福寺小吃',
    cover_image_url: null,
    tier: 'upper',
    category_name: '小吃',
    city_name: '北京',
    district_name: '东城区',
  },
  'demo-8': {
    display_name: '南门涮肉',
    cover_image_url: null,
    tier: 'upper',
    category_name: '火锅',
    city_name: '北京',
    district_name: '东城区',
  },
  'demo-9': {
    display_name: '蓝蛙',
    cover_image_url: null,
    tier: 'upper',
    category_name: '简餐',
    city_name: '上海',
    district_name: '静安区',
  },
  'demo-10': {
    display_name: '一坐一忘',
    cover_image_url: null,
    tier: 'upper',
    category_name: '饭馆',
    city_name: '北京',
    district_name: '朝阳区',
  },
}

export function lookupDemoRestaurant(id: string): DemoRestaurantMeta | null {
  return DEMOS[id] ?? null
}

export function getDemoStoreReviews(restaurantId: string, tier: Tier): StoreReviewItem[] {
  void restaurantId
  return [
    {
      id: 'demo-pr-01',
      nickname: '辣味雷达',
      avatar_url: null,
      tier,
      store_comment: '氛围还可以，但整体偏「及格线」，适合随便吃一吃。',
      created_at: new Date().toISOString(),
      youpin_count: 18,
      yebang_count: 3,
      my_vote: null,
      user_id: '',
    },
    {
      id: 'demo-pr-02',
      nickname: '干饭指南针',
      avatar_url: null,
      tier: 'top',
      store_comment:
        tier === 'boom'
          ? '我觉得这家够夯，但要注意排队和服务节奏。'
          : '和我心里预期有差距：好吃但不至于反复来。',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      youpin_count: 4,
      yebang_count: 9,
      my_vote: null,
      user_id: '',
    },
  ]
}
