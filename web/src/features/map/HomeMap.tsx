import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Search, UtensilsCrossed, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMapRestaurants, type MapRestaurant } from './useMapRestaurants'
import { TIER_ORDER, TIER_LABEL, type Tier } from '@/lib/db'

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

function MapDismiss({ onDismiss }: { onDismiss: () => void }) {
  useMapEvents({ click: onDismiss })
  return null
}

function GeolocateOnMount() {
  const map = useMap()
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.setView([coords.latitude, coords.longitude], 11, { animate: true })
      },
      () => {},
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

interface CityResult {
  name: string
  lat: number
  lng: number
  count: number
}

function SearchBar({
  restaurants,
  onSelectRestaurant,
  onSelectCity,
}: {
  restaurants: MapRestaurant[]
  onSelectRestaurant: (r: MapRestaurant) => void
  onSelectCity: (lat: number, lng: number) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null

    const matchedRestaurants = restaurants
      .filter((r) => r.display_name.toLowerCase().includes(q))
      .slice(0, 5)

    const cityMap = new Map<string, CityResult>()
    for (const r of restaurants) {
      if (!r.city_name?.toLowerCase().includes(q)) continue
      const existing = cityMap.get(r.city_name!)
      if (existing) {
        existing.lat = (existing.lat * existing.count + r.latitude) / (existing.count + 1)
        existing.lng = (existing.lng * existing.count + r.longitude) / (existing.count + 1)
        existing.count++
      } else {
        cityMap.set(r.city_name!, { name: r.city_name!, lat: r.latitude, lng: r.longitude, count: 1 })
      }
    }
    const matchedCities = [...cityMap.values()].slice(0, 3)

    return { restaurants: matchedRestaurants, cities: matchedCities }
  }, [query, restaurants])

  const showDropdown = focused && query.trim().length > 0
  const hasResults = results && (results.restaurants.length > 0 || results.cities.length > 0)

  return (
    <div className="absolute top-3 left-3 right-3 z-[410]">
      <div className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-2.5 shadow-md ring-1 ring-black/[0.06]">
        <Search size={15} className="text-neutral-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="搜索城市、餐厅…"
          className="flex-1 bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none"
        />
        {query && (
          <button
            className="shrink-0 text-neutral-400"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="mt-2 rounded-2xl bg-white shadow-xl ring-1 ring-black/[0.05] overflow-hidden"
          style={{ maxHeight: '60dvh', overflowY: 'auto' }}
        >
          {!hasResults ? (
            <p className="px-4 py-3 text-[13px] text-neutral-400 text-center">无匹配结果</p>
          ) : (
            <>
              {results.cities.map((city) => (
                <button
                  key={city.name}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 border-b border-neutral-50 last:border-0"
                  onClick={() => {
                    onSelectCity(city.lat, city.lng)
                    setQuery('')
                    setFocused(false)
                  }}
                >
                  <MapPin size={14} className="text-neutral-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-neutral-800">{city.name}</p>
                    <p className="text-[11px] text-neutral-400">{city.count} 家餐厅</p>
                  </div>
                </button>
              ))}
              {results.cities.length > 0 && results.restaurants.length > 0 && (
                <div className="h-px bg-neutral-100" />
              )}
              {results.restaurants.map((r) => (
                <button
                  key={r.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-neutral-50 border-b border-neutral-50 last:border-0"
                  onClick={() => {
                    onSelectRestaurant(r)
                    setQuery('')
                    setFocused(false)
                  }}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-orange-100 flex items-center justify-center">
                    {r.cover_image_url ? (
                      <img src={r.cover_image_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UtensilsCrossed size={14} className="text-orange-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-800 truncate">{r.display_name}</p>
                    <p className="text-[11px] text-neutral-400">
                      {[r.city_name, r.district_name].filter(Boolean).join(' · ')}
                    </p>
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

function BottomSheet({
  restaurant: r,
  onClose,
}: {
  restaurant: MapRestaurant
  onClose: () => void
}) {
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
        <div className="flex items-center gap-3 px-4 pt-1 pb-3">
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
            <p className="text-xs text-neutral-400 mt-0.5">
              {[r.city_name, r.district_name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {r.top_store_comment && (
          <>
            <div className="h-px bg-neutral-100 mx-4" />
            <div className="px-4 py-3">
              <p className="text-[11px] text-neutral-400 mb-1.5">
                睿评 · <span className="text-neutral-600 font-medium">{r.top_reviewer_nickname}</span>
              </p>
              <p className="text-[13px] text-neutral-700 leading-relaxed line-clamp-3">
                {r.top_store_comment}
              </p>
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
  const mapRef = useRef<L.Map | null>(null)

  const visibleRestaurants = useMemo(
    () => (selectedTier ? restaurants.filter((r) => r.tier === selectedTier) : restaurants),
    [restaurants, selectedTier],
  )

  const handleMarkerClick = useCallback((r: MapRestaurant) => {
    setSelected(r)
  }, [])

  const dismiss = useCallback(() => setSelected(null), [])

  const handleMapCapture = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const handleSelectRestaurant = useCallback((r: MapRestaurant) => {
    setSelected(r)
    mapRef.current?.flyTo([r.latitude, r.longitude], 14, { animate: true, duration: 0.8 })
  }, [])

  const handleSelectCity = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 11, { animate: true, duration: 0.8 })
  }, [])

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 80px)' }}>
      <SearchBar
        restaurants={restaurants}
        onSelectRestaurant={handleSelectRestaurant}
        onSelectCity={handleSelectCity}
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
        <MapRefCapture onCapture={handleMapCapture} />
        {visibleRestaurants.map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={createRestaurantIcon(r.cover_image_url, r.tier)}
            eventHandlers={{ click: () => handleMarkerClick(r) }}
          />
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
              className="pointer-events-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md ring-1 ring-black/[0.06]"
              style={{
                background: selectedTier === tier ? TIER_HEX[tier] : 'rgba(255,255,255,0.95)',
                color: selectedTier === tier ? TIER_TEXT_COLOR[tier] : '#737373',
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
