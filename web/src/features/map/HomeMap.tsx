import { useCallback, useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMapRestaurants, type MapRestaurant } from './useMapRestaurants'
import { TIER_LABEL, type Tier } from '@/lib/db'

const ChinaCenter: L.LatLngExpression = [35.86, 104.19]

function createAvatarIcon(avatarUrl: string | null, nickname: string): L.DivIcon {
  const initial = (nickname || '食').slice(0, 1)
  const inner = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="font-size:15px;font-weight:700;color:#fff;">${initial}</span>`

  return L.divIcon({
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      border:2.5px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.28);
      background:#f97316;
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;cursor:pointer;
    ">${inner}</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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
        map.setView([coords.latitude, coords.longitude], 13, { animate: true })
      },
      () => {},
      { timeout: 8000, maximumAge: 60_000 },
    )
  }, [map])
  return null
}

const TIER_BG: Record<Tier, string> = {
  boom: 'bg-red-50 text-red-700',
  hang: 'bg-orange-50 text-orange-700',
  top: 'bg-amber-50 text-amber-700',
  upper: 'bg-yellow-50 text-yellow-700',
  npc: 'bg-neutral-100 text-neutral-500',
  bad: 'bg-neutral-100 text-neutral-400',
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
      <div
        className="absolute inset-0 z-[401]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="absolute bottom-3 left-3 right-3 z-[402] rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ animation: 'shijian-slide-up 0.22s ease-out' }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-neutral-200" />
        </div>

        <div className="flex items-start gap-3 px-4 pt-1 pb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-neutral-900 truncate leading-snug">
              {r.display_name}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {[r.city_name, r.district_name].filter(Boolean).join(' · ')}
            </p>
          </div>
          {r.tier && (
            <span
              className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIER_BG[r.tier]}`}
            >
              {TIER_LABEL[r.tier]}
            </span>
          )}
        </div>

        <div className="h-px bg-neutral-100 mx-4" />

        <div className="px-4 py-3 flex gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center">
            {r.creator_avatar_url ? (
              <img
                src={r.creator_avatar_url}
                alt={r.creator_nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-orange-500">
                {r.creator_nickname.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-neutral-400 mb-1">
              首评 · <span className="text-neutral-600 font-medium">{r.creator_nickname}</span>
            </p>
            {r.store_comment ? (
              <p className="text-[13px] text-neutral-700 leading-relaxed line-clamp-3">
                {r.store_comment}
              </p>
            ) : (
              <p className="text-[13px] text-neutral-400 italic">Ta 没有留下评论</p>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          {r.practice_id ? (
            <Link
              to={`/practice/${r.practice_id}`}
              className="block w-full py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold text-center"
            >
              查看完整评价
            </Link>
          ) : (
            <button
              disabled
              className="block w-full py-2.5 rounded-xl bg-neutral-100 text-neutral-400 text-[13px] font-semibold text-center cursor-default"
            >
              暂无评价详情
            </button>
          )}
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
            icon={createAvatarIcon(r.creator_avatar_url, r.creator_nickname)}
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
