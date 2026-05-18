export const CATEGORY_CODES = [
  'zhongcan', 'yiguo', 'huoguo', 'shaokao',
  'kuaican', 'fenmian', 'xiaochi', 'xiuxian',
  'kafei', 'chayin', 'tianpin', 'qita',
] as const

export type CategoryCode = (typeof CATEGORY_CODES)[number]

export const CATEGORY_LABEL: Record<CategoryCode, string> = {
  zhongcan: '中餐',
  yiguo: '异国料理',
  huoguo: '火锅',
  shaokao: '烧烤',
  kuaican: '快餐',
  fenmian: '粉面',
  xiaochi: '小吃',
  xiuxian: '休闲餐饮',
  kafei: '咖啡厅',
  chayin: '茶饮',
  tianpin: '甜品烘焙',
  qita: '其他',
}

interface CategoryRule {
  /** 匹配中类文本（如 "中餐厅"） */
  mid?: string
  /** 匹配小类文本（如 "火锅店"） */
  sub?: string
  /** 关键词正则（匹配 POI 名称） */
  kw?: RegExp
  category: CategoryCode
}

const RULES: CategoryRule[] = [
  { mid: '外国餐厅', category: 'yiguo' },
  { mid: '快餐厅', category: 'kuaican' },
  { mid: '休闲餐饮场所', category: 'xiuxian' },
  { mid: '咖啡厅', category: 'kafei' },
  { mid: '茶艺馆', category: 'chayin' },
  { mid: '冷饮店', category: 'chayin' },
  { mid: '糕饼店', category: 'tianpin' },
  { mid: '甜品店', category: 'tianpin' },
  { sub: '火锅店', category: 'huoguo' },
  { sub: '特色/地方风味餐厅', kw: /烧烤|烤肉|串/, category: 'shaokao' },
  { sub: '特色/地方风味餐厅', kw: /粉|面|米线|螺蛳/, category: 'fenmian' },
  { sub: '特色/地方风味餐厅', category: 'xiaochi' },
  { mid: '中餐厅', category: 'zhongcan' },
  { mid: '餐饮相关场所', category: 'qita' },
]

/**
 * 根据高德 POI type 文本（如 "餐饮服务;中餐厅;火锅店"）和名称匹配业务分类。
 * 规则按优先级排序，返回首条匹配结果；均不匹配时返回 `qita`。
 */
export function matchCategory(amapType: string, poiName: string): CategoryCode {
  const segs = amapType.split(';').map((s) => s.trim())
  const midText = segs[1] ?? segs[0]
  const subText = segs[2] ?? segs[1] ?? segs[0]

  for (const rule of RULES) {
    if (rule.sub && subText !== rule.sub) continue
    if (rule.mid && midText !== rule.mid) continue
    if (rule.kw && !rule.kw.test(poiName)) continue
    return rule.category
  }
  return 'qita'
}

/** 分类代码 → 中文标签，未知代码原样返回 */
export function getCategoryLabel(code: string): string {
  return CATEGORY_LABEL[code as CategoryCode] ?? code
}
