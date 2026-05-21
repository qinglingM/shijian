import type {
  PoiCandidate,
  PoiProvider,
  PoiSearchParams,
} from '@/lib/poi/types'

/** 占位图便于不接高德时也验证封面链路（稳定 seed） */
const mockCover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/320/320`

const MOCK_BEIJING: PoiCandidate[] = [
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_001',
    poi_name: '海底捞火锅（紫竹桥店）',
    address_text: '北京市海淀区紫竹院路 88 号',
    latitude: 39.9527,
    longitude: 116.3056,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '海淀区',
    category: 'hotpot_bbq',
    cover_image_url: mockCover('mock-bj-hdl-zzh'),
    amap_type_code: '050117',
    amap_mid_category: '中餐厅',
    amap_small_category: '火锅店',
    display_label: '火锅',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_002',
    poi_name: '海底捞火锅（五道口店）',
    address_text: '北京市海淀区成府路 28 号',
    latitude: 39.9929,
    longitude: 116.3382,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '海淀区',
    category: 'hotpot_bbq',
    cover_image_url: mockCover('mock-bj-hdl-wdk'),
    amap_type_code: '050117',
    amap_mid_category: '中餐厅',
    amap_small_category: '火锅店',
    display_label: '火锅',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_003',
    poi_name: '南京大牌档（蓝色港湾店）',
    address_text: '北京市朝阳区朝阳公园路 6 号',
    latitude: 39.9485,
    longitude: 116.4742,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    category: 'chinese',
    cover_image_url: mockCover('mock-bj-njdpd'),
    amap_type_code: '050118',
    amap_mid_category: '中餐厅',
    amap_small_category: '特色/地方风味餐厅',
    display_label: '地方风味',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_004',
    poi_name: '局气（三里屯店）',
    address_text: '北京市朝阳区三里屯太古里 N8',
    latitude: 39.9376,
    longitude: 116.4546,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    category: 'chinese',
    cover_image_url: mockCover('mock-bj-jq'),
    amap_type_code: '050111',
    amap_mid_category: '中餐厅',
    amap_small_category: '北京菜',
    display_label: '北京菜',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_005',
    poi_name: '隆福寺小吃店',
    address_text: '北京市东城区隆福寺街 95 号',
    latitude: 39.9286,
    longitude: 116.4159,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '东城区',
    category: 'snack_fast',
    /** 故意 null：验证无封面时前四字占位 */
    cover_image_url: null,
    amap_type_code: '050118',
    amap_mid_category: '中餐厅',
    amap_small_category: '特色/地方风味餐厅',
    display_label: '地方风味',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_006',
    poi_name: '喜茶（西单大悦城店）',
    address_text: '北京市西城区西单北大街 131 号',
    latitude: 39.9105,
    longitude: 116.3739,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '西城区',
    category: 'coffee_tea',
    cover_image_url: mockCover('mock-bj-heytea'),
    amap_type_code: '050700',
    amap_mid_category: '冷饮店',
    amap_small_category: '冷饮店',
    display_label: '冷饮',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_007',
    poi_name: '丰茂烤串（朝阳大悦城店）',
    address_text: '北京市朝阳区青年路 6 号',
    latitude: 39.9202,
    longitude: 116.5151,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    category: 'hotpot_bbq',
    cover_image_url: mockCover('mock-bj-fmc'),
    amap_type_code: '050118',
    amap_mid_category: '中餐厅',
    amap_small_category: '特色/地方风味餐厅',
    display_label: '烧烤',
  },
  {
    poi_source: 'amap',
    poi_id: 'mock_bj_008',
    poi_name: '味千拉面（中关村店）',
    address_text: '北京市海淀区中关村大街 27 号',
    latitude: 39.9803,
    longitude: 116.3091,
    province_name: '北京市',
    city_name: '北京市',
    district_name: '海淀区',
    category: 'japanese_korean',
    cover_image_url: mockCover('mock-bj-qian'),
    amap_type_code: '050202',
    amap_mid_category: '外国餐厅',
    amap_small_category: '日本料理',
    display_label: '日本料理',
  },
]

export class MockPoiProvider implements PoiProvider {
  readonly source = 'amap' as const

  async search({ keyword, signal: _signal }: PoiSearchParams): Promise<PoiCandidate[]> {
    await new Promise((r) => setTimeout(r, 250))
    if (!keyword.trim()) return []
    const kw = keyword.trim().toLowerCase()
    return MOCK_BEIJING.filter(
      (p) =>
        p.poi_name.toLowerCase().includes(kw) ||
        (p.address_text ?? '').toLowerCase().includes(kw) ||
        (p.district_name ?? '').toLowerCase().includes(kw),
    )
  }
}
