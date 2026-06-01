/**
 * POI 抽象层
 *
 * P0 用 MockPoiProvider 提供假数据，
 * 拿到高德 Key 后切换到 AmapPoiProvider，调用方代码无须改动。
 */

export type PoiSource = 'amap' | 'manual' | 'tencent' | 'baidu' | 'apple'

export interface PoiCandidate {
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
  /** 关键字搜索封面（高德 extensions=all 首张；mock；旧草稿可缺省） */
  cover_image_url?: string | null

  amap_type_code?: string | null
  amap_mid_category?: string | null
  amap_small_category?: string | null
  display_label?: string | null
}

export interface PoiSearchParams {
  keyword: string
  city?: string
  signal?: AbortSignal
  /** 1-based 页码，默认 1 */
  page?: number
  /** 每页条数，默认 20 */
  pageSize?: number
}

export interface PoiSearchResult {
  items: PoiCandidate[]
  /** 命中总数（高德 count），用于判断是否还有下一页 */
  total: number
}

export interface PoiProvider {
  readonly source: PoiSource
  search(params: PoiSearchParams): Promise<PoiSearchResult>
}
