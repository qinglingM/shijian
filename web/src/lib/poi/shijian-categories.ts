export const CATEGORY_CODES = [
  'chinese',
  'hotpot_bbq',
  'snack_fast',
  'japanese_korean',
  'western',
  'southeast_asian',
  'coffee_tea',
  'dessert_bakery',
  'other',
] as const

export type ShijianCategoryCode = (typeof CATEGORY_CODES)[number]

export interface ShijianSubCategory {
  code: string
  name: string
}

export interface ShijianCategory {
  code: ShijianCategoryCode
  name: string
  sortOrder: number
  subcategories: ShijianSubCategory[]
}

export const SHIJIAN_CATEGORIES: ShijianCategory[] = [
  {
    code: 'chinese',
    name: '中餐',
    sortOrder: 1,
    subcategories: [
      { code: 'comprehensive_chinese', name: '综合中餐' },
      { code: 'comprehensive_restaurant', name: '综合酒楼' },
      { code: 'sichuan', name: '四川菜' },
      { code: 'guangdong', name: '广东菜' },
      { code: 'shandong', name: '山东菜' },
      { code: 'jiangsu', name: '江苏菜' },
      { code: 'zhejiang', name: '浙江菜' },
      { code: 'shanghai', name: '上海菜' },
      { code: 'hunan', name: '湖南菜' },
      { code: 'anhui', name: '安徽菜' },
      { code: 'fujian', name: '福建菜' },
      { code: 'beijing', name: '北京菜' },
      { code: 'hubei', name: '湖北菜' },
      { code: 'dongbei', name: '东北菜' },
      { code: 'yungui', name: '云贵菜' },
      { code: 'xibei', name: '西北菜' },
      { code: 'laozihao', name: '老字号' },
      { code: 'local_flavor', name: '地方风味' },
      { code: 'seafood', name: '海鲜' },
      { code: 'vegetarian', name: '素食' },
      { code: 'halal', name: '清真菜馆' },
      { code: 'taiwan', name: '台湾菜' },
      { code: 'chaozhou', name: '潮州菜' },
    ],
  },
  {
    code: 'hotpot_bbq',
    name: '火锅烧烤',
    sortOrder: 2,
    subcategories: [
      { code: 'hotpot', name: '火锅' },
      { code: 'bbq', name: '烧烤' },
      { code: 'grilled_meat', name: '烤肉' },
      { code: 'grilled_fish', name: '烤鱼' },
      { code: 'skewer', name: '串串' },
      { code: 'rinsed_meat', name: '涮肉' },
    ],
  },
  {
    code: 'snack_fast',
    name: '小吃快餐',
    sortOrder: 3,
    subcategories: [
      { code: 'fast_food', name: '快餐' },
      { code: 'burger_fried_chicken', name: '汉堡炸鸡' },
      { code: 'chinese_fast_food', name: '中式快餐' },
      { code: 'japanese_fast_food', name: '日式快餐' },
      { code: 'hongkong_fast_food', name: '港式快餐' },
      { code: 'cha_can_ting', name: '茶餐厅' },
      { code: 'noodle_shop', name: '面馆' },
      { code: 'noodle_rice_noodle', name: '粉面' },
      { code: 'rice_noodle', name: '米粉米线' },
      { code: 'malatang', name: '麻辣烫' },
      { code: 'baozi_jiaozi', name: '包子饺子' },
      { code: 'rice_plate', name: '盖饭简餐' },
    ],
  },
  {
    code: 'japanese_korean',
    name: '日韩料理',
    sortOrder: 4,
    subcategories: [
      { code: 'japanese', name: '日本料理' },
      { code: 'korean', name: '韩国料理' },
      { code: 'sushi', name: '寿司' },
      { code: 'japanese_ramen', name: '日式拉面' },
      { code: 'korean_bbq', name: '韩式烤肉' },
      { code: 'izakaya', name: '居酒屋' },
    ],
  },
  {
    code: 'western',
    name: '西餐',
    sortOrder: 5,
    subcategories: [
      { code: 'western_general', name: '西餐' },
      { code: 'french', name: '法国菜' },
      { code: 'italian', name: '意大利菜' },
      { code: 'mediterranean', name: '地中海菜' },
      { code: 'american', name: '美式餐厅' },
      { code: 'british', name: '英国菜' },
      { code: 'steak', name: '牛排' },
      { code: 'russian', name: '俄国菜' },
      { code: 'portuguese', name: '葡国菜' },
      { code: 'german', name: '德国菜' },
      { code: 'brazilian', name: '巴西菜' },
      { code: 'mexican', name: '墨西哥菜' },
      { code: 'pizza', name: '披萨' },
    ],
  },
  {
    code: 'southeast_asian',
    name: '东南亚菜',
    sortOrder: 6,
    subcategories: [
      { code: 'thai_vietnamese', name: '泰越菜' },
      { code: 'indian', name: '印度菜' },
      { code: 'asian_general', name: '亚洲菜' },
      { code: 'southeast_asian_general', name: '东南亚菜' },
    ],
  },
  {
    code: 'coffee_tea',
    name: '咖啡茶饮',
    sortOrder: 7,
    subcategories: [
      { code: 'coffee', name: '咖啡' },
      { code: 'tea_drink', name: '茶饮' },
      { code: 'tea_house', name: '茶馆' },
      { code: 'cold_drink', name: '冷饮' },
      { code: 'juice', name: '果汁' },
      { code: 'milk_tea', name: '奶茶' },
    ],
  },
  {
    code: 'dessert_bakery',
    name: '甜品面包',
    sortOrder: 8,
    subcategories: [
      { code: 'dessert', name: '甜品' },
      { code: 'bakery', name: '面包烘焙' },
      { code: 'cake', name: '蛋糕' },
      { code: 'ice_cream', name: '冰淇淋' },
    ],
  },
  {
    code: 'other',
    name: '其他餐饮',
    sortOrder: 9,
    subcategories: [
      { code: 'other_dining', name: '其他餐饮' },
      { code: 'casual_dining', name: '休闲餐饮' },
      { code: 'dining_related', name: '餐饮相关场所' },
      { code: 'unknown', name: '未知餐饮' },
    ],
  },
]

export const CATEGORY_MAP: Record<ShijianCategoryCode, ShijianCategory> = Object.fromEntries(
  SHIJIAN_CATEGORIES.map((c) => [c.code, c]),
) as Record<ShijianCategoryCode, ShijianCategory>

export const SUBCATEGORY_TO_CATEGORY: Record<string, ShijianCategoryCode> = {}
for (const cat of SHIJIAN_CATEGORIES) {
  for (const sub of cat.subcategories) {
    SUBCATEGORY_TO_CATEGORY[sub.name] = cat.code
  }
}
