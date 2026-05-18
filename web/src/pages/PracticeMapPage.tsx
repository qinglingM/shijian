import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { TIER_LABEL, TIER_ORDER, type Tier } from '@/lib/db'
import { useDisplayedTierMap, type TierMapItem, type TierMapResult } from '@/features/tier-map/useTierMap'

const ChinaCenter: L.LatLngExpression = [35.8617, 104.1954]

function ensureDefaultLeafletIcons() {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: string }
  delete proto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
  })
}

ensureDefaultLeafletIcons()

function FitBounds({
  markers,
}: {
  markers: { lat: number; lng: number }[]
}) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13)
      return
    }
    const b = L.latLngBounds(
      markers.map((m) => L.latLng(m.lat, m.lng)),
    )
    map.fitBounds(b.pad(0.12))
  }, [map, markers])
  return null
}

function tierRank(tier: Tier) {
  return TIER_ORDER.indexOf(tier)
}

/** 同城食鉴图上已展示的店；每店取「更好的一档」，且需有坐标 */
function pinsFromDisplayedMap(map: TierMapResult) {
  const byId = new Map<
    string,
    { tier: Tier; restaurant: TierMapItem }
  >()
  for (const b of map.buckets) {
    for (const r of b.restaurants) {
      const lat = r.latitude
      const lng = r.longitude
      if (lat == null || lng == null) continue
      const prev = byId.get(r.id)
      if (
        !prev ||
        tierRank(b.tier) < tierRank(prev.tier)
      ) {
        byId.set(r.id, { tier: b.tier, restaurant: r })
      }
    }
  }
  return [...byId.values()].map(({ tier, restaurant: r }) => ({
    tier,
    lat: r.latitude as number,
    lng: r.longitude as number,
    r,
  }))
}

export function PracticeMapPage() {
  const { map, showingDemo, isLoading, error } = useDisplayedTierMap()

  const pins = useMemo(() => pinsFromDisplayedMap(map), [map])

  const markerPts = useMemo(
    () => pins.map((p) => ({ lat: p.lat, lng: p.lng })),
    [pins],
  )

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-neutral-100">
      <header className="flex h-12 items-center border-b border-neutral-200 bg-white px-4">
        <h1 className="text-base font-medium">实践地图</h1>
      </header>
      <div className="relative flex-1 min-h-[calc(100vh-9rem)]">
        {isLoading && !showingDemo ? (
          <p className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 text-sm text-neutral-500">
            载入食鉴数据…
          </p>
        ) : null}
        {error && !showingDemo ? (
          <p className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 px-4 text-center text-sm text-rose-500">
            {(error as Error).message}
          </p>
        ) : null}
        <MapContainer
          center={ChinaCenter}
          zoom={4}
          className="absolute inset-0 z-0 h-full w-full outline-none"
          scrollWheelZoom
        >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markerPts.length > 0 ? <FitBounds markers={markerPts} /> : null}
            {pins.map(({ r, tier, lat, lng }) => (
              <Marker key={r.id} position={[lat, lng]}>
                <Popup>
                  <p className="m-0 mb-1 text-[13px] font-semibold text-neutral-900">
                    {r.display_name}
                  </p>
                  <p className="m-0 mb-2 text-[11px] text-neutral-500">
                    {TIER_LABEL[tier]}档
                  </p>
                  <Link
                    to={`/restaurants/${r.id}`}
                    className="text-[12px] font-medium text-orange-700"
                  >
                    查看门店
                  </Link>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
        {pins.length === 0 && (!isLoading || showingDemo) && !error ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[400] mx-auto max-w-sm rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-neutral-600 shadow-lg ring-1 ring-black/5">
            {showingDemo
              ? '示例数据已标在北京附近。连接账户并留下带坐标的实践后，你的真实足迹会出现在这里。'
              : '还没有带坐标的店铺。请在搜店流程中完成定位入库，或稍后再试。'}
          </div>
        ) : null}
      </div>
    </div>
  )
}
