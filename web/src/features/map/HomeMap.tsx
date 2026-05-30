import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Supercluster from 'supercluster'
import { Search, UtensilsCrossed, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { lookupExistingRestaurantByPoi, usePoiSearch } from '@/features/poi-search/usePoiSearch'
import { useCityStore } from '@/features/city-picker/cityStore'
import { useDebounce } from '@/lib/useDebounce'
import { useMapRestaurants, type MapRestaurant } from './useMapRestaurants'
import { UserTitleBadge } from '@/components/UserTitleBadge'
import { TIER_ORDER, TIER_LABEL, type Tier } from '@/lib/db'
import type { PoiCandidate } from '@/lib/poi'
import { useCities } from '@/features/city-picker/useCities'

const ChinaCenter: L.LatLngExpression = [35.86, 104.19]

// Hex values for Leaflet divIcon (CSS vars don't resolve outside React tree)
function removeBracketContent(name: string): string {
  return name.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
}

const AMAP_MID_CATEGORIES: { name: string; subs: string[] }[] = [
  {
    name: '中餐厅',
    subs: ['综合酒楼','四川菜','广东菜','山东菜','江苏菜','浙江菜','上海菜','湖南菜','安徽菜','福建菜','北京菜','湖北菜','东北菜','云贵菜','西北菜','老字号','海鲜酒楼','中式素菜馆','清真菜馆','台湾菜','潮州菜','火锅店','特色/地方风味餐厅']
      .map(s => removeBracketContent(s)),
  },
  {
    name: '外国餐厅',
    subs: ['西餐厅','日本料理','韩国料理','法式菜品餐厅','意式菜品餐厅','泰国/越南菜品餐厅','地中海风格菜品','美式风味','印度风味','英国式菜品餐厅','牛扒店(扒房)','俄国菜','葡国菜','德国菜','巴西菜','墨西哥菜','其它亚洲菜']
      .map(s => removeBracketContent(s)),
  },
  { name: '快餐厅', subs: [] },
  { name: '休闲餐饮场所', subs: [] },
  { name: '咖啡厅', subs: [] },
  { name: '茶艺馆', subs: [] },
  { name: '冷饮店', subs: [] },
  { name: '糕饼店', subs: [] },
  { name: '甜品店', subs: [] },
  { name: '餐饮相关场所', subs: [] },
]

const TIER_HEX: Record<Tier, string> = {
  boom: '#A11A00',
  hang: '#cf5329',
  top: '#e39032',
  upper: '#eddb39',
  npc: '#ede0b9',
  bad: '#f2f1ed',
}

const TIER_TEXT_COLOR: Record<Tier, string> = {
  boom: '#fff',
  hang: '#fff',
  top: '#fff',
  upper: '#5a4a00',
  npc: '#6b5a3a',
  bad: '#999',
}

function createRestaurantIcon(coverImageUrl: string | null, tier: Tier | null, zoom: number): L.DivIcon {
  const s = 40 + Math.max(0, Math.min(24, (zoom - 8) * 3))
  const inner = coverImageUrl
    ? `<img src="${coverImageUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;">🍽</span>`
    : `<span style="font-size:20px;line-height:1;">🍽</span>`

  return L.divIcon({
    html: `<div style="
      width:${s}px;height:${s}px;border-radius:${s * 0.22}px;
      border:3px solid ${tier ? TIER_HEX[tier] : '#e5e5e5'};
      box-shadow:0 2px 10px rgba(0,0,0,0.28),0 0 0 1px rgba(0,0,0,0.08) inset;
      background:#ffffff;
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;cursor:pointer;
    ">${inner}</div>`,
    className: '',
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  })
}

const MapMarker = memo(function MapMarker({
  restaurant,
  zoom,
  onSelect,
}: {
  restaurant: MapRestaurant
  zoom: number
  onSelect: (r: MapRestaurant) => void
}) {
  const icon = useMemo(
    () => createRestaurantIcon(restaurant.cover_image_url, restaurant.tier, zoom),
    [restaurant.cover_image_url, restaurant.tier, zoom],
  )
  return (
    <Marker
      position={[restaurant.latitude, restaurant.longitude]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(restaurant) }}
    />
  )
})

function MapDismiss({ onDismiss }: { onDismiss: () => void }) {
  useMapEvents({ click: onDismiss })
  return null
}

function MapBoundsZoomTracker({ onChange }: { onChange: (b: L.LatLngBounds, z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onChange(map.getBounds(), map.getZoom())
    map.on('moveend', handler)
    handler()
    return () => { map.off('moveend', handler) }
  }, [map, onChange])
  return null
}

const FALLBACK_CLUSTER = { bg: '#a3a3a3', text: '#fff' }

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`
}

function getDominantTier(props: Record<string, number>): Tier | null {
  const maxCount = Math.max(
    props.boom ?? 0, props.hang ?? 0, props.top ?? 0,
    props.upper ?? 0, props.npc ?? 0, props.bad ?? 0,
  )
  if (maxCount <= 0) return null
  return TIER_ORDER.find((t) => (props[t] ?? 0) === maxCount) ?? null
}

function ClusterMarker({ count, lat, lng, onClick, bg, text, border }: {
  count: number
  lat: number
  lng: number
  onClick: () => void
  bg: string
  text: string
  border: string
}) {
  const size = Math.min(52 + Math.log2(count) * 7, 74)
  const icon = useMemo(
    () => L.divIcon({
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${hexToRgba(bg, 0.9)};border:${border};box-shadow:0 2px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? '11px' : '13px'};font-weight:900;color:${text};cursor:pointer;">${count}</div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    }),
    [size, bg, text, border],
  )
  return <Marker position={[lat, lng]} icon={icon} eventHandlers={{ click: onClick }} />
}

function GeolocateOnMount() {
  const map = useMap()
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.setView([coords.latitude, coords.longitude], 10.7, { animate: true })
      },
      () => { },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }, [map])
  return null
}

function MapRefCapture({ onCapture }: { onCapture: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onCapture(map)
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map, onCapture])
  return null
}

function SearchBar({
  onOpenPoi,
  onInteract,
}: {
  onOpenPoi: (poi: PoiCandidate) => Promise<void>
  onInteract: () => void
}) {
  const cityName = useCityStore((s) => s.cityName)
  const tierMapShowsAllChina = useCityStore((s) => s.tierMapShowsAllChina)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [focused, setFocused] = useState(false)
  const [openingPoiId, setOpeningPoiId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyword = debouncedQuery.trim()
  const { data: results = [], isLoading, isFetching } = usePoiSearch(
    keyword,
    tierMapShowsAllChina ? undefined : cityName,
  )

  const showDropdown = focused && keyword.length > 0
  const hasResults = results.length > 0

  async function handlePickPoi(poi: PoiCandidate) {
    setOpeningPoiId(poi.poi_id)
    try {
      await onOpenPoi(poi)
      setQuery('')
      setFocused(false)
    } finally {
      setOpeningPoiId(null)
    }
  }

  return (
    <div>
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 mx-4 my-2">
        <Search size={15} className="shrink-0 text-neutral-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onInteract()
          }}
          onFocus={() => {
            setFocused(true)
            onInteract()
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="搜店名、区域、地址"
          className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none"
        />
        {query && (
          <button
            className="flex items-center justify-center size-5 rounded-full text-neutral-400 active:bg-neutral-200 shrink-0"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="清空搜索词"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="rounded-b-2xl bg-white shadow-xl ring-1 ring-black/[0.05] overflow-hidden"
          style={{ maxHeight: '60dvh', overflowY: 'auto' }}
        >
          {isLoading || isFetching ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">搜索中…</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-[13px] text-neutral-400 text-center">无匹配结果</p>
          ) : (
            results.map((poi) => (
              <button
                key={`${poi.poi_source}-${poi.poi_id}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 border-b border-neutral-50 last:border-0"
                disabled={openingPoiId === poi.poi_id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handlePickPoi(poi)}
              >
                <div className="shrink-0 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-orange-100">
                  {poi.cover_image_url ? (
                    <img src={poi.cover_image_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <UtensilsCrossed size={16} className="text-orange-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-neutral-800">{poi.poi_name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {[poi.city_name, poi.district_name].filter(Boolean).join(' · ') || '区域未知'}
                  </p>
                  {poi.address_text ? (
                    <p className="mt-0.5 truncate text-[11px] text-neutral-400">{poi.address_text}</p>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const TIER_CHIP_WIDTH = 'min-w-[4.5rem]'

function TierChip({ tier, small }: { tier: Tier; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold leading-none text-center ${TIER_CHIP_WIDTH} ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1.5 text-sm'}`}
      style={{ background: TIER_HEX[tier], color: TIER_TEXT_COLOR[tier] }}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}

function BottomSheet({
  restaurant: r,
  exiting,
}: {
  restaurant: MapRestaurant
  exiting?: boolean
}) {
  const fullAddressLine = [r.city_name, r.district_name, r.address_text]
    .filter(Boolean)
    .join(' · ')
  const dateStr = r.review_created_at?.slice(0, 10)

  return (
    <div
      className="absolute bottom-3 left-3 right-3 z-[402] rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ animation: exiting ? 'shijian-slide-down-out 0.22s ease-out forwards' : 'shijian-slide-up 0.22s ease-out' }}
      >
      <Link to={`/restaurants/${r.id}`} className="block active:opacity-80">
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-neutral-200" />
        </div>

        <div className="flex items-start gap-3 px-4 pt-1 pb-3">
          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-orange-100 flex items-center justify-center">
            {r.cover_image_url ? (
              <img src={r.cover_image_url} alt={r.display_name} className="w-full h-full object-cover" />
            ) : (
              <UtensilsCrossed size={24} className="text-orange-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-neutral-900 truncate leading-snug">
              {r.display_name}
            </p>
            {r.amap_mid_category ? (
              <p className="text-xs font-semibold text-neutral-500 mt-0.5 truncate">
                {r.amap_small_category
                  ? `${r.amap_mid_category}·${removeBracketContent(r.amap_small_category)}`
                  : r.amap_mid_category}
              </p>
            ) : null}
            {fullAddressLine ? (
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                {fullAddressLine}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            {r.tier ? (
              <>
                <TierChip tier={r.tier} />
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                  {r.practice_count > 0 ? `${r.practice_count}人评价` : '暂无评价'}
                </span>
              </>
            ) : (
              <>
                <span className={`inline-flex items-center justify-center rounded font-bold leading-none text-center ${TIER_CHIP_WIDTH} px-2 py-1.5 text-sm bg-neutral-200 text-neutral-400`}>
                  未评级
                </span>
              </>
            )}
          </div>
        </div>

        {r.top_store_comment && (
          <>
            <div className="h-px bg-neutral-100 mx-4" />
            <div
              className="px-4 pb-3 pt-2"
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                gridTemplateRows: 'auto auto',
                gridTemplateAreas: `"avatar name hot meta" "avatar comment comment meta"`,
                columnGap: 8,
                rowGap: 4,
              }}
            >
              <div style={{ gridArea: 'avatar' }} className="flex items-start">
                {r.top_reviewer_avatar_url ? (
                  <img src={r.top_reviewer_avatar_url} alt="" className="w-[41px] h-[41px] rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-[41px] h-[41px] rounded-full bg-neutral-200 shrink-0 flex items-center justify-center text-[10px] text-neutral-500 font-medium">
                    {r.top_reviewer_nickname?.[0] ?? '?'}
                  </div>
                )}
              </div>
              <div style={{ gridArea: 'name' }} className="flex items-center">
                <p className="truncate text-[11px] font-semibold text-sky-700">
                  {r.top_reviewer_nickname}<UserTitleBadge name={r.titleName} />
                </p>
              </div>
              <div style={{ gridArea: 'hot' }} className="flex items-center justify-self-start">
                <span className="whitespace-nowrap text-[11px] font-semibold text-orange-500">热评</span>
              </div>
              <div style={{ gridArea: 'meta' }} className="flex flex-col items-center justify-self-end gap-0.5">
                {dateStr ? (
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">{dateStr}</span>
                ) : null}
                {r.review_tier ? <TierChip tier={r.review_tier} small /> : null}
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">有品 {r.review_youpin}</span>
              </div>
              <div style={{ gridArea: 'comment' }} className="flex items-start">
                <p className="flex-1 min-w-0 text-[15px] font-semibold text-neutral-700 leading-relaxed line-clamp-2">
                  {r.top_store_comment}
                </p>
              </div>
            </div>
          </>
        )}
      </Link>
      </div>
  )
}

export function HomeMap() {
  const { data: restaurants = [], isLoading, error } = useMapRestaurants()
  const [selected, setSelected] = useState<MapRestaurant | null>(null)
  const [exiting, setExiting] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null)
  const [zoom, setZoom] = useState(4)
  const mapRef = useRef<L.Map | null>(null)
  const navigate = useNavigate()
  const superclusterRef = useRef<Supercluster | null>(null)

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'city' | 'tier' | 'category'>('city')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null)

  const [appliedCity, setAppliedCity] = useState<string | null>(null)
  const [appliedTier, setAppliedTier] = useState<Tier | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null)
  const [pendingCity, setPendingCity] = useState<string | null>(null)
  const [pendingTier, setPendingTier] = useState<Tier | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  // Cities data for province → city drill-down
  const { data: allCities = [] } = useCities()
  const provinces = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of allCities) {
      const p = c.province_name?.trim() || '其他'
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(c.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
  }, [allCities])

  const categoryGroups = useMemo(() => AMAP_MID_CATEGORIES, [])

  const visibleRestaurants = useMemo(
    () => {
      let filtered = restaurants
      if (appliedCity) filtered = filtered.filter(r => r.city_name === appliedCity)
      if (appliedTier) filtered = filtered.filter(r => r.tier === appliedTier)
      if (appliedCategory) {
        // Match against both mid_category and small_category
        filtered = filtered.filter(r => 
          r.amap_mid_category === appliedCategory || 
          removeBracketContent(r.amap_small_category || '') === appliedCategory
        )
      }
      return filtered
    },
    [restaurants, appliedCity, appliedTier, appliedCategory],
  )

  const clusters = useMemo(() => {
    if (!bounds || visibleRestaurants.length === 0) return null
    const sc = superclusterRef.current
    if (!sc) return null
    const [west, south, east, north] = bounds.toBBoxString().split(',').map(Number)
    return sc.getClusters([west, south, east, north], Math.round(zoom))
  }, [visibleRestaurants, bounds, zoom])

  const handleBoundsChange = useCallback((b: L.LatLngBounds, z: number) => {
    setBounds(b)
    setZoom(z)
  }, [])

  useEffect(() => {
    if (visibleRestaurants.length === 0) {
      superclusterRef.current = null
      return
    }
    const sc = new Supercluster({
      radius: 60,
      maxZoom: 16,
      map: (props) => ({
        boom: props.restaurant?.tier === 'boom' ? 1 : 0,
        hang: props.restaurant?.tier === 'hang' ? 1 : 0,
        top: props.restaurant?.tier === 'top' ? 1 : 0,
        upper: props.restaurant?.tier === 'upper' ? 1 : 0,
        npc: props.restaurant?.tier === 'npc' ? 1 : 0,
        bad: props.restaurant?.tier === 'bad' ? 1 : 0,
      }),
      reduce: (acc, props) => {
        acc.boom += props.boom
        acc.hang += props.hang
        acc.top += props.top
        acc.upper += props.upper
        acc.npc += props.npc
        acc.bad += props.bad
      },
    })
    sc.load(visibleRestaurants.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: { restaurant: r },
    })))
    superclusterRef.current = sc
  }, [visibleRestaurants])

  const dismiss = useCallback(() => {
    if (!selected) return
    setExiting(true)
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSelected(null)
      setExiting(false)
    }, 220)
  }, [selected])

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current)
    setExiting(false)
  }, [])

  const handleSelect = useCallback((r: MapRestaurant) => {
    if (selected && r.id === selected.id) {
      dismiss()
    } else {
      cancelClose()
      setSelected(r)
    }
  }, [cancelClose, dismiss, selected])

  const handleMapCapture = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const handleOpenPoi = useCallback(
    async (poi: PoiCandidate) => {
      if (poi.latitude !== null && poi.longitude !== null) {
        mapRef.current?.flyTo([poi.latitude, poi.longitude], 15, {
          animate: true,
          duration: 0.8,
        })
      }

      const existingId = await lookupExistingRestaurantByPoi(poi.poi_source, poi.poi_id)
      if (existingId) {
        navigate(`/restaurants/${existingId}`, { state: { poi } })
        return
      }
      navigate(`/restaurants/poi/${poi.poi_source}/${poi.poi_id}`, {
        state: { poi },
      })
    },
    [navigate],
  )

  function handleReset() {
    setSelectedProvince(null)
    setSelectedBigCategory(null)
    if (filterTab === 'city') { setPendingCity(null); setAppliedCity(null) }
    if (filterTab === 'tier') { setPendingTier(null); setAppliedTier(null) }
    if (filterTab === 'category') { setPendingCategory(null); setAppliedCategory(null) }
  }

  function handleDismiss() {
    setFilterOpen(false)
  }

  return (
    <div className="relative h-full w-full">
      {/* Toolbar + Filter panel */}
      <div className="absolute top-0 left-0 right-0 z-[999]">
        <div className="relative bg-white shadow-sm pt-[env(safe-area-inset-top)]">
          <SearchBar
            onOpenPoi={handleOpenPoi}
            onInteract={dismiss}
          />
          {/* Filter buttons: browser-tab style, equal-width */}
          <div className="flex bg-neutral-50/40">
          <button
            onClick={() => { setPendingCity(appliedCity); setFilterTab('city'); setFilterOpen(true) }}
            className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
              filterTab === 'city' && filterOpen
                ? 'text-blue-600'
                : appliedCity
                  ? 'text-blue-600'
                  : 'text-neutral-600'
            }`}
          >
            {appliedCity || '城市'}
            {(filterTab === 'city' && filterOpen) || appliedCity ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
            ) : null}
          </button>
          <div className="w-px bg-neutral-100" />
          <button
            onClick={() => { setPendingTier(appliedTier); setFilterTab('tier'); setFilterOpen(true) }}
            className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
              filterTab === 'tier' && filterOpen
                ? 'text-blue-600'
                : appliedTier
                  ? 'text-blue-600'
                  : 'text-neutral-600'
            }`}
          >
            {appliedTier ? TIER_LABEL[appliedTier] : '等级'}
            {(filterTab === 'tier' && filterOpen) || appliedTier ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
            ) : null}
          </button>
          <div className="w-px bg-neutral-100" />
          <button
            onClick={() => { setPendingCategory(appliedCategory); setFilterTab('category'); setFilterOpen(true) }}
            className={`flex-1 py-1.5 text-[13px] font-medium transition-colors relative ${
              filterTab === 'category' && filterOpen
                ? 'text-blue-600'
                : appliedCategory
                  ? 'text-blue-600'
                  : 'text-neutral-600'
            }`}
          >
            {appliedCategory || '分类'}
            {(filterTab === 'category' && filterOpen) || appliedCategory ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
            ) : null}
          </button>
        </div>
      </div>

      {filterOpen && (
        <>
          <div className="fixed inset-0 z-[997]" onClick={handleDismiss} />
          <div
            className="absolute top-full left-0 right-0 z-[998] mx-auto max-w-md bg-white shadow-xl rounded-b-2xl overflow-hidden"
            style={{ animation: 'shijian-slide-down 0.2s ease-out' }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: '45dvh' }}>
              {filterTab === 'city' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {provinces.map(([pname]) => (
                      <button
                        key={pname}
                        onClick={() => setSelectedProvince(selectedProvince === pname ? null : pname)}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${
                          selectedProvince === pname
                            ? 'bg-white font-semibold text-blue-600'
                            : 'text-neutral-700 hover:bg-white/80'
                        }`}
                      >
                        {pname}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const cities = selectedProvince
                        ? provinces.find(([p]) => p === selectedProvince)?.[1] ?? []
                        : []
                      return cities.length > 0 ? (
                        cities.map((name) => (
                          <button
                            key={name}
                            onClick={() => setPendingCity(pendingCity === name ? null : name)}
                            className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                              pendingCity === name
                                ? 'font-semibold text-blue-600'
                                : 'text-neutral-700'
                            }`}
                          >
                            {name}
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-6 text-center text-[12px] text-neutral-400">请先选择省份</p>
                      )
                    })()}
                  </div>
                </div>
              )}

              {filterTab === 'tier' && (
                <div className="grid grid-cols-3 gap-3 px-4 py-5">
                  {TIER_ORDER.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setPendingTier(pendingTier === tier ? null : tier)}
                      className={`rounded-lg py-3 text-[13px] font-bold leading-none transition-all ${
                        pendingTier === tier
                          ? 'ring-2 ring-blue-500 ring-offset-2 scale-105'
                          : 'shadow-sm ring-1 ring-black/[0.06]'
                      }`}
                      style={{ background: TIER_HEX[tier], color: TIER_TEXT_COLOR[tier] }}
                    >
                      {TIER_LABEL[tier]}
                    </button>
                  ))}
                </div>
              )}

              {filterTab === 'category' && (
                <div className="flex" style={{ height: '30dvh' }}>
                  <div className="w-[140px] shrink-0 overflow-y-auto border-r border-neutral-100 bg-neutral-50/50">
                    {categoryGroups.map((g) => (
                      <button
                        key={g.name}
                        onClick={() => {
                          if (selectedBigCategory === g.name) {
                            setSelectedBigCategory(null)
                            setPendingCategory(null)
                          } else {
                            setSelectedBigCategory(g.name)
                            setPendingCategory(g.name)
                          }
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors ${
                          selectedBigCategory === g.name
                            ? 'bg-white font-semibold text-blue-600'
                            : 'text-neutral-700 hover:bg-white/80'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const active = categoryGroups.find(g => g.name === selectedBigCategory)
                      return active ? (
                        active.subs.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => setPendingCategory(pendingCategory === sub ? null : sub)}
                            className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                              pendingCategory === sub
                                ? 'font-semibold text-blue-600'
                                : 'text-neutral-700'
                            }`}
                          >
                            {sub}
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-6 text-center text-[12px] text-neutral-400">请先选择大类</p>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Reset + Confirm buttons */}
            <div className="border-t border-neutral-100 px-4 py-3 flex gap-3">
              <button onClick={handleReset} className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 text-[14px] font-semibold text-neutral-600 shadow-sm active:bg-neutral-50">重置</button>
              <button
                onClick={() => { setAppliedCity(pendingCity); setAppliedTier(pendingTier); setAppliedCategory(pendingCategory); setFilterOpen(false) }}
                disabled={filterTab === 'city' && !!selectedProvince && !pendingCity}
                className={`flex-1 rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm ${
                  filterTab === 'city' && selectedProvince && !pendingCity
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-500 active:bg-blue-600'
                }`}
              >
                确定
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <p className="text-sm text-neutral-500">载入食鉴地图…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 top-16 z-[500] rounded-xl bg-white px-4 py-3 shadow-lg text-center">
          <p className="text-sm text-rose-500">地图数据加载失败</p>
        </div>
      )}

      <MapContainer
        center={ChinaCenter}
        zoom={4}
        minZoom={3}
        maxBounds={[[3, 70], [56, 140]]}
        className="absolute inset-0 h-full w-full outline-none"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
          subdomains="1234"
          maxZoom={18}
        />
        <GeolocateOnMount />
        <MapDismiss onDismiss={dismiss} />
        <MapBoundsZoomTracker onChange={handleBoundsChange} />
        <MapRefCapture onCapture={handleMapCapture} />
        {(clusters ?? (
          bounds
            ? visibleRestaurants.filter((r) => bounds.contains([r.latitude, r.longitude]))
            : visibleRestaurants
        )).map((f: any) => {
          const [lng, lat] = f.geometry ? f.geometry.coordinates : [f.longitude, f.latitude]
          const isCluster = f.properties?.cluster
          if (isCluster) {
            const dominantTier = getDominantTier(f.properties)
            const cc = dominantTier
              ? { bg: TIER_HEX[dominantTier], text: TIER_TEXT_COLOR[dominantTier] }
              : FALLBACK_CLUSTER
            const border = dominantTier === 'bad' ? '2px solid rgba(0,0,0,0.35)' : ''
            return (
              <ClusterMarker
                key={`c-${f.properties.cluster_id}`}
                count={f.properties.point_count}
                lat={lat}
                lng={lng}
                bg={cc.bg}
                text={cc.text}
                border={border}
                onClick={() => {
                  const map = mapRef.current
                  if (map) map.flyTo([lat, lng], Math.min(zoom + 2, 18), { animate: true, duration: 0.5 })
                }}
              />
            )
          }
          const restaurant: MapRestaurant = f.properties?.restaurant ?? f
          return (
            <MapMarker key={`${restaurant.id}-${restaurant.tier}`} restaurant={restaurant} zoom={zoom} onSelect={handleSelect} />
          )
        })}
      </MapContainer>

      {selected && <BottomSheet restaurant={selected} exiting={exiting} />}

      {restaurants.length === 0 && !isLoading && !error && (
        <div className="pointer-events-none absolute bottom-16 left-4 right-4 z-[400] rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-500 shadow-lg ring-1 ring-black/5">
          还没有已入库的餐厅，完成第一次食鉴后会在地图上出现
        </div>
      )}
    </div>
  )
}
