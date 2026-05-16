import type { CityRow } from '@/lib/db'

/**
 * 省级 → 省会城市 / 首府标准名（与 cities.name、cities.province_name、迁移 0008 对齐）
 */
export const PROVINCE_CAPITAL_CITY_NAME: Record<string, string> = {
  安徽省: '合肥市',
  北京市: '北京',
  重庆市: '重庆',
  福建省: '福州市',
  甘肃省: '兰州市',
  广东省: '广州市',
  贵州省: '贵阳市',
  广西壮族自治区: '南宁市',
  海南省: '海口市',
  河北省: '石家庄市',
  河南省: '郑州市',
  黑龙江省: '哈尔滨市',
  湖北省: '武汉市',
  湖南省: '长沙市',
  吉林省: '长春市',
  江苏省: '南京市',
  江西省: '南昌市',
  辽宁省: '沈阳市',
  内蒙古自治区: '呼和浩特市',
  宁夏回族自治区: '银川市',
  青海省: '西宁市',
  山东省: '济南市',
  山西省: '太原市',
  陕西省: '西安市',
  上海市: '上海',
  四川省: '成都市',
  天津市: '天津',
  西藏自治区: '拉萨市',
  新疆维吾尔自治区: '乌鲁木齐市',
  云南省: '昆明市',
  浙江省: '杭州市',
}

/**
 * 用于省级 A→Z：按拉丁读音关键词排序（全小写）。
 * 不含映射的行政区排在尾部（zzz-）。
 */
export const PROVINCE_LATIN_SORT_KEY: Record<string, string> = {
  安徽省: 'anhui',
  北京市: 'beijing',
  重庆市: 'chongqing',
  福建省: 'fujian',
  甘肃省: 'gansu',
  广东省: 'guangdong',
  广西壮族自治区: 'guangxi',
  贵州省: 'guizhou',
  海南省: 'hainan',
  河北省: 'hebei',
  河南省: 'henan',
  黑龙江省: 'heilongjiang',
  湖北省: 'hubei',
  湖南省: 'hunan',
  吉林省: 'jilin',
  江苏省: 'jiangsu',
  江西省: 'jiangxi',
  辽宁省: 'liaoning',
  内蒙古自治区: 'neimenggu',
  宁夏回族自治区: 'ningxia',
  青海省: 'qinghai',
  山东省: 'shandong',
  山西省: 'shanxi-jin',
  陕西省: 'shanxi-shaan',
  上海市: 'shanghai',
  四川省: 'sichuan',
  天津市: 'tianjin',
  西藏自治区: 'xizang',
  新疆维吾尔自治区: 'xinjiang',
  云南省: 'yunnan',
  浙江省: 'zhejiang',
}

interface CityRowLike {
  name: string
  province_name?: string | null
}

/** cities.name 为直辖单名时与「××市」后缀区分 */
const DIRECT_MUNICIPALITY_PROVINCE_NAMES = new Set([
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
])

/**
 * 省内二级排序量级：地级市（含直筒子「××市」、直辖单名）优先（0）；
 * 自治州 / 盟 / 地区 / 县等次之（1）。与 0008 名录命名一致。
 */
export function cityInProvinceAdministrativeTier(row: CityRowLike): number {
  const pn = (row.province_name ?? '').trim()
  if (DIRECT_MUNICIPALITY_PROVINCE_NAMES.has(pn)) return 0

  const n = (row.name ?? '').trim()
  if (!n) return 1
  if (n.endsWith('市')) return 0

  return 1
}

export function provinceLatinSortKey(provinceFullName: string | null): string {
  const p = (provinceFullName ?? '').trim()
  if (!p) return 'zzz-missing-province'
  return PROVINCE_LATIN_SORT_KEY[p] ?? `zzz-unknown-${p}`
}

/** 侧边索引用：省级分区首拉丁字母（未收录省级归 #） */
export function provinceLatinBucketLetter(provinceFullName: string | null): string {
  const key = provinceLatinSortKey(provinceFullName)
  if (key.startsWith('zzz-')) return '#'
  const ch = key.charAt(0).toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
}

function normalizeCapitalNameKey(name: string) {
  return name.trim().replace(/市$/u, '')
}

/** 省会城市 / 首府：仅用于省内排序置顶，不含 UI 标记 */
export function isProvinceCapitalCity(row: CityRowLike): boolean {
  const province = row.province_name?.trim()
  if (!province) return false
  const canon = PROVINCE_CAPITAL_CITY_NAME[province]
  if (!canon) return false
  return normalizeCapitalNameKey(row.name) === normalizeCapitalNameKey(canon)
}

/** 地级市首字母：优先 name_pinyin，否则归为 #（靠后展示） */
export function cityFirstLatinLetter(row: { name_pinyin: string | null }): string {
  const py = (row.name_pinyin ?? '').trim().toLowerCase()
  const f = py.charAt(0)
  return f >= 'a' && f <= 'z' ? f : '#'
}

export function compareCitiesInProvince(a: CityRow, b: CityRow): number {
  const tierA = cityInProvinceAdministrativeTier(a)
  const tierB = cityInProvinceAdministrativeTier(b)
  if (tierA !== tierB) return tierA - tierB

  const ac = isProvinceCapitalCity(a)
  const bc = isProvinceCapitalCity(b)
  if (ac !== bc) return ac ? -1 : 1

  const la = cityFirstLatinLetter(a)
  const lb = cityFirstLatinLetter(b)
  if (la !== lb) {
    if (la === '#') return 1
    if (lb === '#') return -1
    return la.localeCompare(lb)
  }
  return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' })
}

/** 分组并排序省份及其下属城市（用于城市选择面板） */
export function buildProvinceOrderedSections(citiesInput: CityRow[]): {
  provinces: string[]
  byProvince: Map<string, CityRow[]>
  bucketFirstProvince: Record<string, string | undefined>
} {
  const byProvince = new Map<string, CityRow[]>()
  for (const c of citiesInput) {
    const pn = (c.province_name ?? '').trim() || '——'
    const arr = byProvince.get(pn) ?? []
    arr.push(c)
    byProvince.set(pn, arr)
  }

  const provinces = [...byProvince.keys()].sort((a, b) =>
    provinceLatinSortKey(a === '——' ? null : a).localeCompare(
      provinceLatinSortKey(b === '——' ? null : b),
    ),
  )

  const bucketFirstProvince: Record<string, string | undefined> = {}

  for (const pname of provinces) {
    const list = [...(byProvince.get(pname) ?? [])].sort(compareCitiesInProvince)
    byProvince.set(pname, list)
    const bucket = provinceLatinBucketLetter(pname === '——' ? null : pname)
    if (!(bucket in bucketFirstProvince)) bucketFirstProvince[bucket] = pname
  }

  return { provinces, byProvince, bucketFirstProvince }
}
