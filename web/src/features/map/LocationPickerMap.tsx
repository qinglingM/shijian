import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, LocateFixed } from 'lucide-react'
import { AMAP_KEY } from '@/lib/env'

export interface LocationPickResult {
  latitude: number
  longitude: number
  /** 高德逆地理返回的格式化地址 */
  formattedAddress: string
  /**
   * 城市名，如「北京市」。
   * 注意：直辖市（北京/上海/天津/重庆）高德返回空数组，此时用 provinceName 代替。
   */
  cityName: string
  /** 省份名，如「北京市」——直辖市匹配城市时的兜底字段 */
  provinceName: string
  /** 行政区名，如「朝阳区」 */
  districtName: string
}

interface Props {
  /** 地图初始中心；不传则默认北京 */
  initialLat?: number
  initialLng?: number
  /** 地图拖动停止且逆地理解析完成后回调 */
  onPick: (result: LocationPickResult) => void
}

// ── 高德逆地理 ─────────────────────────────────────────────────────────────────

async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<{ formattedAddress: string; cityName: string; provinceName: string; districtName: string }> {
  const params = new URLSearchParams({
    key: AMAP_KEY,
    location: `${lng.toFixed(6)},${lat.toFixed(6)}`,
    extensions: 'base',
    output: 'json',
  })
  const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`)
  if (!res.ok) throw new Error(`高德地址解析失败 (HTTP ${res.status})`)
  const data = (await res.json()) as {
    status?: string
    info?: string
    regeocode?: {
      formatted_address?: string
      addressComponent?: {
        city?: string | string[]
        province?: string | string[]
        district?: string
      }
    }
  }
  if (data.status !== '1' || !data.regeocode?.formatted_address) {
    throw new Error(data.info ?? '地址解析异常')
  }
  const ac = data.regeocode.addressComponent
  // 直辖市（北京/上海/天津/重庆）city 返回 []，需用 province 兜底
  const rawCity = ac?.city
  const rawProvince = ac?.province
  const cityName = Array.isArray(rawCity) ? '' : (rawCity ?? '')
  const provinceName = Array.isArray(rawProvince) ? '' : (rawProvince ?? '')
  return {
    formattedAddress: data.regeocode.formatted_address,
    cityName,
    provinceName,
    districtName: ac?.district ?? '',
  }
}

// ── 地图内部事件监听 ────────────────────────────────────────────────────────────

function MoveEndHandler({
  onMoveEnd,
}: {
  onMoveEnd: (lat: number, lng: number) => void
}) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter()
      onMoveEnd(Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6)))
    },
  })
  return null
}

// ── 主组件 ─────────────────────────────────────────────────────────────────────

const BEIJING: [number, number] = [39.9042, 116.4074]

export function LocationPickerMap({ initialLat, initialLng, onPick }: Props) {
  const center: [number, number] = [initialLat ?? BEIJING[0], initialLng ?? BEIJING[1]]

  const [status, setStatus] = useState<'idle' | 'resolving' | 'locating' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 拖动结束 → 防抖 600ms → 逆地理
  const handleMoveEnd = useCallback(
    (lat: number, lng: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setStatus('resolving')
        setErrorMsg(null)
        reverseGeocode(lng, lat)
          .then((r) => {
            onPick({ latitude: lat, longitude: lng, ...r })
            setStatus('idle')
          })
          .catch((err: unknown) => {
            setErrorMsg(err instanceof Error ? err.message : '地址解析失败')
            setStatus('error')
          })
      }, 600)
    },
    [onPick],
  )

  // 清理定时器
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // GPS 定位 → 移动地图中心（通过外部 ref 操作 Leaflet map 实例）
  const mapRef = useRef<L.Map | null>(null)

  async function locateMe() {
    if (!navigator.geolocation) return
    setStatus('locating')
    setErrorMsg(null)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        }),
      )
      const lat = Number(pos.coords.latitude.toFixed(6))
      const lng = Number(pos.coords.longitude.toFixed(6))
      mapRef.current?.setView([lat, lng], 16, { animate: true })
      // moveend 事件会自动触发 handleMoveEnd，无需手动调逆地理
      setStatus('idle')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '定位失败，请手动拖动地图')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-2">
      {/* 地图容器 */}
      <div className="relative overflow-hidden rounded-xl ring-1 ring-neutral-200" style={{ height: 220 }}>
        <MapContainer
          center={center}
          zoom={15}
          className="absolute inset-0 h-full w-full outline-none"
          zoomControl={false}
          attributionControl={false}
          ref={mapRef}
        >
          <TileLayer
            url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
            subdomains="1234"
            maxZoom={18}
          />
          <MoveEndHandler onMoveEnd={handleMoveEnd} />
        </MapContainer>

        {/* 固定中心 pin — z-[1000] 高于 Leaflet 所有图层（marker pane = 600） */}
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          {/* pin 整体向上偏移半个自身高度，使针尖对准地图中心 */}
          <div className="flex flex-col items-center" style={{ marginTop: '-28px' }}>
            <div
              className="size-6 rounded-full border-[3px] border-white bg-orange-500"
              style={{ boxShadow: '0 2px 10px rgba(234,88,12,0.65)' }}
            />
            {/* 针杆 */}
            <div className="h-4 w-[3px] rounded-b-full bg-orange-500" />
            {/* 针尖阴影点 */}
            <div className="h-1 w-2 rounded-full bg-black/20" style={{ marginTop: '-1px' }} />
          </div>
        </div>

        {/* 右上角：定位到我 */}
        <button
          type="button"
          onClick={() => void locateMe()}
          disabled={status === 'locating'}
          className="absolute right-2 top-2 z-[500] flex size-8 items-center justify-center rounded-lg bg-white/95 shadow ring-1 ring-black/[0.06] active:bg-neutral-100 disabled:opacity-50"
          title="定位到我"
        >
          {status === 'locating' ? (
            <Loader2 size={15} className="animate-spin text-orange-500" />
          ) : (
            <LocateFixed size={15} className="text-orange-500" />
          )}
        </button>

        {/* 底部状态提示 */}
        {(status === 'resolving' || status === 'error') && (
          <div
            className={`absolute bottom-2 left-2 right-2 z-[500] rounded-lg px-2.5 py-1.5 text-[11px] shadow ${
              status === 'error'
                ? 'bg-white/95 text-amber-600'
                : 'bg-white/95 text-neutral-500'
            }`}
          >
            {status === 'error' ? errorMsg : '正在解析地址…'}
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-400">拖动地图选点，松手后自动填入地址和城市</p>
    </div>
  )
}
