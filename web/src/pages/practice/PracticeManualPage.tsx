import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, ChevronRight, Loader2, LocateFixed } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { CurrentLocationCitySection } from '@/features/city-picker/CurrentLocationCitySection'
import { useCities } from '@/features/city-picker/useCities'
import { useDistricts } from '@/features/city-picker/useDistricts'
import { useCategories } from '@/features/categories/useCategories'
import { useCityStore } from '@/features/city-picker/cityStore'
import { AMAP_KEY } from '@/lib/env'
import { readImageAsDataUrl } from '@/lib/imageFile'
import { usePracticeDraft } from '@/stores/practiceDraft'

/** 本页表单控件统一高度与圆角，避免输入框与下拉大小不一 */
const MANUAL_CONTROL =
  'box-border h-11 w-full rounded-xl border-0 bg-neutral-100 px-3 text-[13px] text-neutral-900 outline-none ring-1 ring-neutral-100 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-orange-400/55'

export function PracticeManualPage() {
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)

  return (
    <>
      <BackHeader title="手动补充店铺" backTo="/practice/step1" />
      {!confirmed ? (
        <ManualWarning
          onContinue={() => setConfirmed(true)}
          onCancel={() => navigate(-1)}
        />
      ) : (
        <ManualForm />
      )}
    </>
  )
}

function ManualWarning({
  onContinue,
  onCancel,
}: {
  onContinue: () => void
  onCancel: () => void
}) {
  return (
    <div className="px-5 py-8">
      <h2 className="text-base font-medium text-neutral-900">先确认一下</h2>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        手动补充仅用于高德地图中暂未找到或信息明显错误的店铺。
        <br />
        建议先尝试更换关键词搜索。
      </p>
      <div className="mt-8 space-y-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-1 rounded-2xl bg-neutral-100 py-3.5 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft size={14} />
          返回重新搜索
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="block w-full rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-center text-sm font-medium text-white shadow-md shadow-orange-700/25"
        >
          继续手动补充
        </button>
      </div>
    </div>
  )
}

function ManualLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <div className="flex min-h-[1.25rem] flex-wrap items-baseline gap-x-2 gap-y-0">
      <span className="text-xs font-medium text-neutral-800">
        {children}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {hint ? <span className="text-[10px] text-neutral-400">{hint}</span> : null}
    </div>
  )
}

function ManualSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${MANUAL_CONTROL} cursor-pointer appearance-none disabled:cursor-not-allowed disabled:bg-neutral-100/70 disabled:text-neutral-400 ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function ManualForm() {
  const navigate = useNavigate()
  const setManual = usePracticeDraft((s) => s.setManual)
  const currentCityId = useCityStore((s) => s.cityId)
  const currentCityName = useCityStore((s) => s.cityName)

  const [brandName, setBrandName] = useState('')
  const [cityId, setCityId] = useState<string | null>(currentCityId)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [locationHint, setLocationHint] = useState('')
  const [addressText, setAddressText] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const { data: cities = [] } = useCities()
  const { data: districts = [] } = useDistricts(cityId)
  const { data: categories = [] } = useCategories()

  const cityName =
    cities.find((c) => c.id === cityId)?.name ?? currentCityName ?? ''
  const districtName = districts.find((d) => d.id === districtId)?.name ?? null
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null

  const canSubmit = brandName.trim() !== '' && !!cityId && !!categoryId

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setCoverImageUrl(await readImageAsDataUrl(file))
    } catch {
      // 用户选择的文件不是图片，静默忽略
    }
    e.target.value = ''
  }

  async function locateAndFillAddress() {
    if (!navigator.geolocation) {
      setLocationError('当前浏览器不支持定位')
      return
    }

    setLocating(true)
    setLocationError(null)
    try {
      const position = await getCurrentPosition()
      const lat = Number(position.coords.latitude.toFixed(6))
      const lng = Number(position.coords.longitude.toFixed(6))
      setLatitude(lat)
      setLongitude(lng)
      setLocationHint(`${lat}, ${lng}`)

      if (!AMAP_KEY) {
        setLocationError('缺少高德 Key，已先填入经纬度')
        return
      }

      const regeocode = await reverseGeocode(lng, lat)
      setAddressText(regeocode.formatted_address)

      const matchedCity = cities.find((c) => c.name === regeocode.city)
      if (matchedCity) setCityId(matchedCity.id)

      const matchedDistrict = districts.find((d) => d.name === regeocode.district)
      if (matchedDistrict) setDistrictId(matchedDistrict.id)
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : '定位失败')
    } finally {
      setLocating(false)
    }
  }

  function submit() {
    if (!canSubmit) return
    setManual({
      brand_name: brandName.trim(),
      city_id: cityId,
      city_name: cityName,
      district_id: districtId,
      district_name: districtName,
      location_hint: locationHint.trim() || null,
      address_text: addressText.trim() || null,
      latitude,
      longitude,
      cover_image_url: coverImageUrl,
      category_id: categoryId,
      category_name: categoryName,
    })
    navigate('/practice/step2')
  }

  return (
    <div className="space-y-8 px-5 py-5 pb-10">
      {/* —— 第一步 —— */}
      <section className="space-y-5">
        <h2 className="text-[13px] font-semibold text-neutral-800">第一步：填写店铺信息</h2>

        <div className="flex gap-4 items-start">
          <div className="shrink-0">
            <ManualLabel>照片</ManualLabel>
            <label className="relative mt-2 block size-[7.875rem] cursor-pointer overflow-hidden rounded-xl bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200/80 transition-colors [&:focus-within]:ring-2 [&:focus-within]:ring-orange-400/70">
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center text-[11px] leading-snug">
                  <Camera size={22} strokeWidth={1.8} />
                  上传照片
                </span>
              )}
              <input type="file" accept="image/*" onChange={handleCoverChange} className="sr-only" />
            </label>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <ManualLabel required>店名</ManualLabel>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="如 海底捞·紫竹桥店"
                className={`${MANUAL_CONTROL} mt-2 w-full`}
              />
            </div>

            <div>
              <ManualLabel required hint="并排">
                城市 · 行政区
              </ManualLabel>
              <CurrentLocationCitySection
                className="mb-3 mt-2"
                cities={cities}
                disabled={cities.length === 0}
                selectedCityId={cityId}
                onSelectCity={(c) => {
                  setCityId(c.id)
                  setDistrictId(null)
                }}
              />
              <div className="grid w-full grid-cols-2 gap-2">
                <ManualSelect
                  value={cityId ?? ''}
                  onChange={(v) => {
                    setCityId(v || null)
                    setDistrictId(null)
                  }}
                  options={cities.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="城市"
                />
                <ManualSelect
                  value={districtId ?? ''}
                  onChange={(v) => setDistrictId(v || null)}
                  options={districts.map((d) => ({ value: d.id, label: d.name }))}
                  placeholder={cityId ? '行政区' : '城市'}
                  disabled={!cityId}
                />
              </div>
            </div>

            <div>
              <ManualLabel required>分类</ManualLabel>
              <ManualSelect
                value={categoryId ?? ''}
                onChange={(v) => setCategoryId(v || null)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="选择分类"
                className="mt-2 block w-full min-w-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* —— 第二步 —— */}
      <section className="space-y-4 border-t border-neutral-100 pt-8">
        <h2 className="text-[13px] font-semibold text-neutral-800">第二步：位置与补充</h2>

        <div>
          <ManualLabel hint="可先填或稍后由定位填入">详细地址</ManualLabel>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="填写街道门牌等信息"
            className={`${MANUAL_CONTROL} mt-2 w-full`}
          />
        </div>

        <div>
          <ManualLabel hint="逆地理回填地址">地图选点</ManualLabel>
          <button
            type="button"
            onClick={locateAndFillAddress}
            disabled={locating}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-3 text-[13px] font-medium text-white shadow-md shadow-orange-700/25 disabled:opacity-50"
          >
            {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {locating ? '正在获取位置…' : '获取当前位置（地图选点开发中）'}
          </button>
          {locationError && (
            <p className="mt-2 text-[11px] text-amber-600">{locationError}</p>
          )}
        </div>

        <div>
          <ManualLabel hint="选填">位置补充</ManualLabel>
          <input
            value={locationHint}
            onChange={(e) => setLocationHint(e.target.value)}
            placeholder="如 临街哪一侧、地铁口怎么走"
            className={`${MANUAL_CONTROL} mt-2 w-full`}
          />
        </div>
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="flex w-full items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-700/25 disabled:opacity-50"
      >
        继续到放进食鉴图
        <ChevronRight size={14} />
      </button>
      <p className="text-center text-[11px] text-neutral-400">
        手动补充同样不立即入库 · 完成评价后才正式创建餐厅
      </p>
    </div>
  )
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    })
  })
}

async function reverseGeocode(longitude: number, latitude: number) {
  const params = new URLSearchParams({
    key: AMAP_KEY,
    location: `${longitude},${latitude}`,
    extensions: 'base',
    output: 'json',
  })
  const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`)
  if (!res.ok) throw new Error('高德地址解析失败')

  const data = (await res.json()) as {
    status?: string
    info?: string
    regeocode?: {
      formatted_address?: string
      addressComponent?: {
        city?: string | string[]
        district?: string
      }
    }
  }

  if (data.status !== '1' || !data.regeocode?.formatted_address) {
    throw new Error(data.info || '没有解析到详细地址')
  }

  const city = data.regeocode.addressComponent?.city
  return {
    formatted_address: data.regeocode.formatted_address,
    city: Array.isArray(city) ? '' : city || '',
    district: data.regeocode.addressComponent?.district || '',
  }
}
