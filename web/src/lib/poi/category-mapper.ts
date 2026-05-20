import type { ShijianCategoryCode } from './shijian-categories'

export interface MappingResult {
  categoryCode: ShijianCategoryCode
  categoryName: string
  subcategoryName: string
  displayLabel: string
  confidence: number
  source: 'brand_mapping' | 'exact_mapping' | 'mid_fallback' | 'keyword_mapping' | 'unknown'
}

export function removeBracketContent(name: string): string {
  return name
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
}

function parseAmapType(amapType: string): {
  bigText: string
  midText: string
  subText: string
} {
  const segs = amapType.split(';').map((s) => s.trim())
  return {
    bigText: segs[0] ?? '',
    midText: segs[1] ?? segs[0] ?? '',
    subText: segs[2] ?? segs[1] ?? segs[0] ?? '',
  }
}

type BrandKey = string

interface ExactRule {
  mid: string
  sub: string
  kw?: RegExp
  categoryCode: ShijianCategoryCode
  subcategoryName: string
}

const BRAND_MAPPING: Record<BrandKey, MappingResult> = {
  '快餐厅:麦当劳': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:肯德基': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:汉堡王': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:德克士': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:华莱士': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '汉堡炸鸡', displayLabel: '汉堡炸鸡', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:必胜客': { categoryCode: 'western', categoryName: '西餐', subcategoryName: '披萨', displayLabel: '披萨', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:吉野家': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '日式快餐', displayLabel: '日式快餐', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:永和豆浆': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '中式快餐', displayLabel: '中式快餐', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:大家乐': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:大快活': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:茶餐厅': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '茶餐厅', displayLabel: '茶餐厅', confidence: 0.95, source: 'brand_mapping' },
  '快餐厅:美心': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '港式快餐', displayLabel: '港式快餐', confidence: 0.85, source: 'brand_mapping' },
  '快餐厅:仙跡岩': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '茶饮', displayLabel: '茶饮', confidence: 0.8, source: 'brand_mapping' },
  '快餐厅:呷哺呷哺': { categoryCode: 'hotpot_bbq', categoryName: '火锅烧烤', subcategoryName: '火锅', displayLabel: '火锅', confidence: 0.9, source: 'brand_mapping' },
  '咖啡厅:星巴克咖啡': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡', confidence: 0.95, source: 'brand_mapping' },
  '咖啡厅:上岛咖啡': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡', confidence: 0.95, source: 'brand_mapping' },
  '咖啡厅:Pacific Coffee Company': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡', confidence: 0.95, source: 'brand_mapping' },
  '咖啡厅:巴黎咖啡店': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡', confidence: 0.9, source: 'brand_mapping' },
}

const EXACT_RULES: ExactRule[] = [
  { mid: '中餐厅', sub: '中餐厅', categoryCode: 'chinese', subcategoryName: '综合中餐' },
  { mid: '中餐厅', sub: '综合酒楼', categoryCode: 'chinese', subcategoryName: '综合酒楼' },
  { mid: '中餐厅', sub: '四川菜(川菜)', categoryCode: 'chinese', subcategoryName: '四川菜' },
  { mid: '中餐厅', sub: '广东菜(粤菜)', categoryCode: 'chinese', subcategoryName: '广东菜' },
  { mid: '中餐厅', sub: '山东菜(鲁菜)', categoryCode: 'chinese', subcategoryName: '山东菜' },
  { mid: '中餐厅', sub: '江苏菜', categoryCode: 'chinese', subcategoryName: '江苏菜' },
  { mid: '中餐厅', sub: '浙江菜', categoryCode: 'chinese', subcategoryName: '浙江菜' },
  { mid: '中餐厅', sub: '上海菜', categoryCode: 'chinese', subcategoryName: '上海菜' },
  { mid: '中餐厅', sub: '湖南菜(湘菜)', categoryCode: 'chinese', subcategoryName: '湖南菜' },
  { mid: '中餐厅', sub: '安徽菜(徽菜)', categoryCode: 'chinese', subcategoryName: '安徽菜' },
  { mid: '中餐厅', sub: '福建菜', categoryCode: 'chinese', subcategoryName: '福建菜' },
  { mid: '中餐厅', sub: '北京菜', categoryCode: 'chinese', subcategoryName: '北京菜' },
  { mid: '中餐厅', sub: '湖北菜(鄂菜)', categoryCode: 'chinese', subcategoryName: '湖北菜' },
  { mid: '中餐厅', sub: '东北菜', categoryCode: 'chinese', subcategoryName: '东北菜' },
  { mid: '中餐厅', sub: '云贵菜', categoryCode: 'chinese', subcategoryName: '云贵菜' },
  { mid: '中餐厅', sub: '西北菜', categoryCode: 'chinese', subcategoryName: '西北菜' },
  { mid: '中餐厅', sub: '老字号', categoryCode: 'chinese', subcategoryName: '老字号' },
  { mid: '中餐厅', sub: '海鲜酒楼', categoryCode: 'chinese', subcategoryName: '海鲜' },
  { mid: '中餐厅', sub: '中式素菜馆', categoryCode: 'chinese', subcategoryName: '素食' },
  { mid: '中餐厅', sub: '清真菜馆', categoryCode: 'chinese', subcategoryName: '清真菜馆' },
  { mid: '中餐厅', sub: '台湾菜', categoryCode: 'chinese', subcategoryName: '台湾菜' },
  { mid: '中餐厅', sub: '潮州菜', categoryCode: 'chinese', subcategoryName: '潮州菜' },
  { mid: '中餐厅', sub: '火锅店', categoryCode: 'hotpot_bbq', subcategoryName: '火锅' },

  { mid: '外国餐厅', sub: '外国餐厅', categoryCode: 'western', subcategoryName: '西餐' },
  { mid: '外国餐厅', sub: '西餐厅(综合风味)', categoryCode: 'western', subcategoryName: '西餐' },
  { mid: '外国餐厅', sub: '日本料理', categoryCode: 'japanese_korean', subcategoryName: '日本料理' },
  { mid: '外国餐厅', sub: '韩国料理', categoryCode: 'japanese_korean', subcategoryName: '韩国料理' },
  { mid: '外国餐厅', sub: '法式菜品餐厅', categoryCode: 'western', subcategoryName: '法国菜' },
  { mid: '外国餐厅', sub: '意式菜品餐厅', categoryCode: 'western', subcategoryName: '意大利菜' },
  { mid: '外国餐厅', sub: '泰国/越南菜品餐厅', categoryCode: 'southeast_asian', subcategoryName: '泰越菜' },
  { mid: '外国餐厅', sub: '地中海风格菜品', categoryCode: 'western', subcategoryName: '地中海菜' },
  { mid: '外国餐厅', sub: '美式风味', categoryCode: 'western', subcategoryName: '美式餐厅' },
  { mid: '外国餐厅', sub: '印度风味', categoryCode: 'southeast_asian', subcategoryName: '印度菜' },
  { mid: '外国餐厅', sub: '英国式菜品餐厅', categoryCode: 'western', subcategoryName: '英国菜' },
  { mid: '外国餐厅', sub: '牛扒店(扒房)', categoryCode: 'western', subcategoryName: '牛排' },
  { mid: '外国餐厅', sub: '俄国菜', categoryCode: 'western', subcategoryName: '俄国菜' },
  { mid: '外国餐厅', sub: '葡国菜', categoryCode: 'western', subcategoryName: '葡国菜' },
  { mid: '外国餐厅', sub: '德国菜', categoryCode: 'western', subcategoryName: '德国菜' },
  { mid: '外国餐厅', sub: '巴西菜', categoryCode: 'western', subcategoryName: '巴西菜' },
  { mid: '外国餐厅', sub: '墨西哥菜', categoryCode: 'western', subcategoryName: '墨西哥菜' },
  { mid: '外国餐厅', sub: '其它亚洲菜', categoryCode: 'southeast_asian', subcategoryName: '亚洲菜' },
]

const KEYWORD_RULES: ExactRule[] = [
  { mid: '中餐厅', sub: '特色/地方风味餐厅', kw: /烧烤|烤肉|烤串|串/, categoryCode: 'hotpot_bbq', subcategoryName: '烧烤' },
  { mid: '中餐厅', sub: '特色/地方风味餐厅', kw: /粉|面|米线|螺蛳/, categoryCode: 'snack_fast', subcategoryName: '粉面' },
  { mid: '中餐厅', sub: '特色/地方风味餐厅', categoryCode: 'chinese', subcategoryName: '地方风味' },
]

const MID_FALLBACK: Record<string, MappingResult> = {
  '中餐厅': { categoryCode: 'chinese', categoryName: '中餐', subcategoryName: '综合中餐', displayLabel: '综合中餐', confidence: 0.6, source: 'mid_fallback' },
  '外国餐厅': { categoryCode: 'western', categoryName: '西餐', subcategoryName: '西餐', displayLabel: '西餐', confidence: 0.6, source: 'mid_fallback' },
  '快餐厅': { categoryCode: 'snack_fast', categoryName: '小吃快餐', subcategoryName: '快餐', displayLabel: '快餐', confidence: 0.6, source: 'mid_fallback' },
  '休闲餐饮场所': { categoryCode: 'other', categoryName: '其他餐饮', subcategoryName: '休闲餐饮', displayLabel: '休闲餐饮', confidence: 0.6, source: 'mid_fallback' },
  '咖啡厅': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '咖啡', displayLabel: '咖啡', confidence: 0.6, source: 'mid_fallback' },
  '茶艺馆': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '茶馆', displayLabel: '茶馆', confidence: 0.6, source: 'mid_fallback' },
  '冷饮店': { categoryCode: 'coffee_tea', categoryName: '咖啡茶饮', subcategoryName: '冷饮', displayLabel: '冷饮', confidence: 0.6, source: 'mid_fallback' },
  '糕饼店': { categoryCode: 'dessert_bakery', categoryName: '甜品面包', subcategoryName: '面包烘焙', displayLabel: '面包烘焙', confidence: 0.6, source: 'mid_fallback' },
  '甜品店': { categoryCode: 'dessert_bakery', categoryName: '甜品面包', subcategoryName: '甜品', displayLabel: '甜品', confidence: 0.6, source: 'mid_fallback' },
  '餐饮相关场所': { categoryCode: 'other', categoryName: '其他餐饮', subcategoryName: '餐饮相关场所', displayLabel: '餐饮相关场所', confidence: 0.5, source: 'mid_fallback' },
}

const UNKNOWN_RESULT: MappingResult = {
  categoryCode: 'other',
  categoryName: '其他餐饮',
  subcategoryName: '其他餐饮',
  displayLabel: '其他餐饮',
  confidence: 0.3,
  source: 'unknown',
}

const CATEGORY_NAME_MAP: Record<ShijianCategoryCode, string> = {
  chinese: '中餐',
  hotpot_bbq: '火锅烧烤',
  snack_fast: '小吃快餐',
  japanese_korean: '日韩料理',
  western: '西餐',
  southeast_asian: '东南亚菜',
  coffee_tea: '咖啡茶饮',
  dessert_bakery: '甜品面包',
  other: '其他餐饮',
}

function result(r: MappingResult): MappingResult {
  return {
    ...r,
    categoryName: CATEGORY_NAME_MAP[r.categoryCode] ?? r.categoryName,
  }
}

export function mapAmapToShijian(
  amapType: string,
  poiName: string,
): MappingResult {
  const { midText, subText } = parseAmapType(amapType)

  if (!midText && !subText) return result(UNKNOWN_RESULT)

  const brandKey = `${midText}:${subText}` as BrandKey
  if (BRAND_MAPPING[brandKey]) {
    return result(BRAND_MAPPING[brandKey])
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.mid && midText !== rule.mid) continue
    if (rule.sub && subText !== rule.sub) continue
    if (rule.kw && !rule.kw.test(poiName)) continue
    return result({
      categoryCode: rule.categoryCode,
      categoryName: CATEGORY_NAME_MAP[rule.categoryCode],
      subcategoryName: rule.subcategoryName,
      displayLabel: rule.subcategoryName,
      confidence: 0.85,
      source: 'keyword_mapping',
    })
  }

  for (const rule of EXACT_RULES) {
    if (rule.mid && midText !== rule.mid) continue
    if (rule.sub && subText !== rule.sub) continue
    return result({
      categoryCode: rule.categoryCode,
      categoryName: CATEGORY_NAME_MAP[rule.categoryCode],
      subcategoryName: rule.subcategoryName,
      displayLabel: rule.subcategoryName,
      confidence: 0.9,
      source: 'exact_mapping',
    })
  }

  const cleanedSub = removeBracketContent(subText)
  for (const rule of EXACT_RULES) {
    if (rule.mid && midText !== rule.mid) continue
    const cleanedRule = removeBracketContent(rule.sub)
    if (cleanedRule && cleanedSub === cleanedRule) {
      return result({
        categoryCode: rule.categoryCode,
        categoryName: CATEGORY_NAME_MAP[rule.categoryCode],
        subcategoryName: rule.subcategoryName,
        displayLabel: rule.subcategoryName,
        confidence: 0.85,
        source: 'exact_mapping',
      })
    }
  }

  if (MID_FALLBACK[midText]) {
    return result(MID_FALLBACK[midText])
  }

  return result(UNKNOWN_RESULT)
}
