import { useCallback, useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMapRestaurants, type MapRestaurant } from './useMapRestaurants'

const ChinaCenter: L.LatLngExpression = [35.86, 104.19]

function createRestaurantIcon(coverImageUrl: string | null): L.DivIcon {
  const inner = coverImageUrl
    ? `<img src="${coverImageUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;">🍽</span>`
    : `<span style="font-size:20px;line-height:1;">🍽</span>`

  return L.divIcon({
    html: `<div style="
      width:44px;height:44px;border-radius:10px;
      border:2.5px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.28);
      background:#fed7aa;
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
        {/* 拖拽把手 */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-neutral-200" />
        </div>

        {/* 店铺封面 + 基本信息 */}
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

        {/* 最高有品睿评 */}
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

        {/* 进入店铺详情 */}
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

  const handleMarkerClick = useCallback((r: MapRestaurant) => {
    setSelected(r)
  }, [])

  const dismiss = useCallback(() => setSelected(null), [])

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 80px)' }}>
      <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-none">
        <Link
          to="/search"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-2.5 shadow-md ring-1 ring-black/[0.06]"
        >
          <Search size={15} className="text-neutral-400 shrink-0" />
          <span className="text-[13px] text-neutral-400">搜索城市、餐厅…</span>
        </Link>
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
        {restaurants.map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={createRestaurantIcon(r.cover_image_url)}
            eventHandlers={{ click: () => handleMarkerClick(r) }}
          />
        ))}
      </MapContainer>

      {selected && <BottomSheet restaurant={selected} onClose={dismiss} />}

      {restaurants.length === 0 && !isLoading && !error && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[400] rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-500 shadow-lg ring-1 ring-black/5">
          还没有已入库的餐厅，完成第一次食鉴后会在地图上出现
        </div>
      )}
    </div>
  )
}
