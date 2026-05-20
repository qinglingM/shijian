import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, UtensilsCrossed, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { DiscoveryTopBar } from '@/components/layout/DiscoveryTopBar'
import { lookupExistingRestaurantByPoi, usePoiSearch } from '@/features/poi-search/usePoiSearch'
import { useCityStore } from '@/features/city-picker/cityStore'
import { useMapRestaurants, type MapRestaurant } from './useMapRestaurants'
import { TIER_ORDER, TIER_LABEL, type Tier } from '@/lib/db'
import type { PoiCandidate } from '@/lib/poi'

const ChinaCenter: L.LatLngExpression = [35.86, 104.19]

// Hex values for Leaflet divIcon (CSS vars don't resolve outside React tree)
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

function createRestaurantIcon(coverImageUrl: string | null, tier: Tier | null): L.DivIcon {
  const bg = tier ? TIER_HEX[tier] : '#fed7aa'
  const inner = coverImageUrl
    ? `<img src="${coverImageUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;">🍽</span>`
    : `<span style="font-size:20px;line-height:1;">🍽</span>`

  return L.divIcon({
    html: `<div style="
      width:44px;height:44px;border-radius:10px;
      border:3px solid ${tier ? TIER_HEX[tier] : '#e5e5e5'};
      box-shadow:0 2px 10px rgba(0,0,0,0.28);
      background:${bg};
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;cursor:pointer;
    ">${inner}</div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

const MapMarker = memo(function MapMarker({
  restaurant,
  onSelect,
}: {
  restaurant: MapRestaurant
  onSelect: (r: MapRestaurant) => void
}) {
  const icon = useMemo(
    () => createRestaurantIcon(restaurant.cover_image_url, restaurant.tier),
    [restaurant.cover_image_url, restaurant.tier],
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

function MapBoundsTracker({ onBoundsChange }: { onBoundsChange: (b: L.LatLngBounds) => void }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onBoundsChange(map.getBounds())
    map.on('moveend', handler)
    handler()
    return () => { map.off('moveend', handler) }
  }, [map, onBoundsChange])
  return null
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
  useEffect(() => { onCapture(map) }, [map, onCapture])
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
  const [focused, setFocused] = useState(false)
  const [openingPoiId, setOpeningPoiId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyword = query.trim()
  const { data: results = [], isLoading, isFetching } = usePoiSearch(
    keyword,
    tierMapShowsAllChina ? undefined : cityName,
  )

  const showDropdown = focused && keyword.length > 0
  const hasResults = results.length > 0
  const cityScopeLabel = tierMapShowsAllChina ? '全国' : cityName

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
    <div className="absolute top-3 left-3 right-3 z-[410]">
      <DiscoveryTopBar
        className="gap-2"
        searchSlot={(
          <div className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-2.5 shadow-md ring-1 ring-black/[0.06]">
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
              placeholder={`在${cityScopeLabel}搜店名、区域、地址`}
              className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none"
            />
            {query && (
              <button
                className="shrink-0 text-neutral-400"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                aria-label="清空搜索词"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      />

      {showDropdown && (
        <div
          className="mt-2 rounded-2xl bg-white shadow-xl ring-1 ring-black/[0.05] overflow-hidden"
          style={{ maxHeight: '60dvh', overflowY: 'auto' }}
        >
          {isLoading || isFetching ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">搜索中…</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-[13px] text-neutral-400 text-center">无匹配结果</p>
          ) : (
            <>
              {results.map((poi) => (
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
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {poi.poi_name}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {[poi.city_name, poi.district_name].filter(Boolean).join(' · ') || '区域未知'}
                    </p>
                    {poi.address_text ? (
                      <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                        {poi.address_text}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </>
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
  onClose,
}: {
  restaurant: MapRestaurant
  onClose: () => void
}) {
  const locationLine = [r.city_name, r.district_name].filter(Boolean).join(' · ')
  const metaPieces = [locationLine].filter(Boolean)
  const addressLine = r.address_text
  const dateStr = r.review_created_at?.slice(0, 10)

  return (
    <>
      <div className="absolute inset-0 z-[401]" onClick={onClose} aria-hidden />
      <div
        className="absolute bottom-3 left-3 right-3 z-[402] rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ animation: 'shijian-slide-up 0.22s ease-out' }}
      >
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
            {metaPieces.length > 0 ? (
              <p className="text-xs text-neutral-400 mt-0.5">
                {metaPieces.join(' · ')}
              </p>
            ) : null}
            {addressLine ? (
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                {addressLine}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            {r.tier ? (
              <>
                <TierChip tier={r.tier} />
                {r.category_name != null && r.category_name !== '' ? (
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">{r.category_name}</span>
                ) : null}
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                  {r.practice_count > 0 ? `${r.practice_count}人评价` : '暂无评价'}
                </span>
              </>
            ) : (
              <>
                <span className={`inline-flex items-center justify-center rounded font-bold leading-none text-center ${TIER_CHIP_WIDTH} px-2 py-1.5 text-sm bg-neutral-200 text-neutral-400`}>
                  未评级
                </span>
                {r.category_name != null && r.category_name !== '' ? (
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">{r.category_name}</span>
                ) : null}
              </>
            )}
          </div>
        </div>

        {r.top_store_comment && (
          <>
            <div className="h-px bg-neutral-100 mx-4" />
            <div className="px-4 py-3 grid grid-cols-[1fr_auto] gap-x-3">
              {/* Row 1 Col 1: avatar + username + 热评 */}
              <div className="flex items-start gap-[19.5px]">
                {r.top_reviewer_avatar_url ? (
                  <img src={r.top_reviewer_avatar_url} alt="" className="w-[41px] h-[41px] rounded-full object-cover shrink-0 ml-[7.5px] mt-[11.5px]" />
                ) : (
                  <div className="w-[41px] h-[41px] rounded-full bg-neutral-200 shrink-0 flex items-center justify-center text-[10px] text-neutral-500 font-medium ml-[7.5px] mt-[11.5px]">
                    {r.top_reviewer_nickname?.[0] ?? '?'}
                  </div>
                )}
                <p className="text-[11px] text-neutral-600 min-w-0 truncate font-medium">
                  {r.top_reviewer_nickname}
                </p>
                <span className="ml-auto shrink-0 text-[11px] text-orange-500 font-semibold whitespace-nowrap">热评</span>
              </div>
              {/* Row 1 Col 2: date */}
              <div className="justify-self-end">
                {dateStr ? (
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">{dateStr}</span>
                ) : null}
              </div>
              {/* Row 2 Col 1: comment */}
              <div className="flex items-start pl-[68px] -mt-[20px]">
                <p className="flex-1 min-w-0 text-[15px] font-semibold text-neutral-700 leading-relaxed line-clamp-3">
                  {r.top_store_comment}
                </p>
              </div>
              {/* Row 2 Col 2: tier + 有品 */}
              <div className="flex flex-col items-end gap-0.5 justify-self-end -mt-[20px]">
                {r.review_tier ? <TierChip tier={r.review_tier} small /> : null}
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">有品 {r.review_youpin}</span>
              </div>
            </div>
          </>
        )}

        <div className="px-4 pb-4 pt-1">
          <Link
            to={`/restaurants/${r.id}`}
            className="block w-full py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold text-center"
          >
            查看店铺详情
          </Link>
        </div>
      </div>
    </>
  )
}

export function HomeMap() {
  const { data: restaurants = [], isLoading, error } = useMapRestaurants()
  const [selected, setSelected] = useState<MapRestaurant | null>(null)
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null)
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const navigate = useNavigate()

  const visibleRestaurants = useMemo(
    () => (selectedTier ? restaurants.filter((r) => r.tier === selectedTier) : restaurants),
    [restaurants, selectedTier],
  )

  const displayMarkers = useMemo(
    () => bounds ? visibleRestaurants.filter((r) => bounds.contains([r.latitude, r.longitude])) : visibleRestaurants,
    [visibleRestaurants, bounds],
  )

  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    setBounds(b)
  }, [])

  const dismiss = useCallback(() => setSelected(null), [])

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

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 80px)' }}>
      <SearchBar
        onOpenPoi={handleOpenPoi}
        onInteract={dismiss}
      />

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
        <MapBoundsTracker onBoundsChange={handleBoundsChange} />
        <MapRefCapture onCapture={handleMapCapture} />
        {displayMarkers.map((r) => (
          <MapMarker key={r.id} restaurant={r} onSelect={handleMarkerClick} />
        ))}
      </MapContainer>

      {selected && <BottomSheet restaurant={selected} onClose={dismiss} />}

      {/* 等级筛选 chips，底部悬浮；底部卡片弹出时隐藏 */}
      {!selected && (
        <div
          className="absolute bottom-3 left-0 right-0 z-[400] flex gap-2 overflow-x-auto px-3 pointer-events-none"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            className="pointer-events-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md ring-1 ring-black/[0.06]"
            style={{
              background: selectedTier === null ? '#171717' : 'rgba(255,255,255,0.95)',
              color: selectedTier === null ? '#fff' : '#737373',
            }}
            onClick={() => setSelectedTier(null)}
          >
            全部
          </button>
          {TIER_ORDER.map((tier) => (
            <button
              key={tier}
              className="pointer-events-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md"
              style={{
                background: TIER_HEX[tier],
                color: TIER_TEXT_COLOR[tier],
                opacity: selectedTier !== null && selectedTier !== tier ? 0.4 : 1,
              }}
              onClick={() => setSelectedTier((t) => (t === tier ? null : tier))}
            >
              {TIER_LABEL[tier]}
            </button>
          ))}
        </div>
      )}

      {restaurants.length === 0 && !isLoading && !error && (
        <div className="pointer-events-none absolute bottom-16 left-4 right-4 z-[400] rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-500 shadow-lg ring-1 ring-black/5">
          还没有已入库的餐厅，完成第一次食鉴后会在地图上出现
        </div>
      )}
    </div>
  )
}
