import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { LocationPickerMap, type LocationPickResult } from '@/features/map/LocationPickerMap'
import { useCities } from '@/features/city-picker/useCities'
import { useCategories } from '@/features/categories/useCategories'
import { useCityStore } from '@/features/city-picker/cityStore'
import { AMAP_KEY } from '@/lib/env'
import { readImageAsDataUrl } from '@/lib/imageFile'
import { usePracticeDraft } from '@/stores/practiceDraft'

/** 本页表单控件统一高度与圆角 */
const MANUAL_CONTROL =
  'box-border h-11 w-full rounded-xl border-0 bg-neutral-100 px-3 text-[13px] text-neutral-900 outline-none ring-1 ring-neutral-100 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-orange-400/55'

export function PracticeManualPage() {
  return (
    <>
      <BackHeader title="手动补充店铺" backTo="/practice/step1" />
      <ManualForm />
    </>
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

  // ── 基本信息 ────────────────────────────────────────────────────────────────
  const [brandName, setBrandName] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)

  // ── 位置信息 ────────────────────────────────────────────────────────────────
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [addressText, setAddressText] = useState('')
  const [locationHint, setLocationHint] = useState('')

  // ── 城市 / 行政区（由地图选点自动填，也可手动调整） ─────────────────────────
  const [cityId, setCityId] = useState<string | null>(currentCityId)
  /** 行政区名（如「朝阳区」）；DB 无区 id，直接存名字 */
  const [districtName, setDistrictName] = useState<string>('')
  const { data: cities = [] } = useCities()
  const { data: categories = [] } = useCategories()

  const cityName = cities.find((c) => c.id === cityId)?.name ?? currentCityName ?? ''
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null

  // ── 行政区：从高德 /v3/config/district 动态拉取 ──────────────────────────────
  const [amapDistricts, setAmapDistricts] = useState<{ name: string; adcode: string }[]>([])
  const [districtsLoading, setDistrictsLoading] = useState(false)

  useEffect(() => {
    const name = cityName.trim()
    if (!name || !AMAP_KEY) { setAmapDistricts([]); return }
    let cancelled = false
    setDistrictsLoading(true)
    const params = new URLSearchParams({
      key: AMAP_KEY,
      keywords: name,
      subdistrict: '2',
      extensions: 'base',
      output: 'json',
    })
    fetch(`https://restapi.amap.com/v3/config/district?${params}`)
      .then((r) => r.json())
      .then((data: { status?: string; districts?: Array<{ level?: string; districts?: Array<{ level?: string; districts?: Array<{ name: string; adcode: string }>; name: string; adcode: string }> }> }) => {
        if (cancelled) return
        const top = data.districts?.[0]
        // 直辖市（北京/上海/天津/重庆）：高德返回 level='province'，实际区级在第三层
        const subs: { name: string; adcode: string }[] = top?.level === 'province'
          ? (top.districts?.[0]?.districts ?? [])
          : (top?.districts ?? [])
        setAmapDistricts(subs)
      })
      .catch(() => { if (!cancelled) setAmapDistricts([]) })
      .finally(() => { if (!cancelled) setDistrictsLoading(false) })
    return () => { cancelled = true }
  }, [cityName])

  // 地图选点初始中心
  const initLat = latitude ?? undefined
  const initLng = longitude ?? undefined

  // ── 地图选点回调 ─────────────────────────────────────────────────────────────
  function handleLocationPick(result: LocationPickResult) {
    setLatitude(result.latitude)
    setLongitude(result.longitude)
    setAddressText(result.formattedAddress)

    // 直辖市 cityName 为空，用 provinceName 兜底匹配
    const nameToMatch = result.cityName || result.provinceName
    const matchedCity = cities.find((c) => {
      if (!nameToMatch) return false
      // 精确匹配或互相包含（「北京」↔「北京市」）
      return (
        c.name === nameToMatch ||
        (nameToMatch.length > 0 && nameToMatch.includes(c.name)) ||
        (c.name.length > 0 && c.name.includes(nameToMatch))
      )
    })
    if (matchedCity) {
      setCityId(matchedCity.id)
    }

    // 行政区直接用名字设置（不依赖 DB id）
    setDistrictName(result.districtName)
  }

  // ── 图片 ────────────────────────────────────────────────────────────────────
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

  // ── 提交 ────────────────────────────────────────────────────────────────────
  const canSubmit = brandName.trim() !== '' && !!cityId && !!categoryId

  function submit() {
    if (!canSubmit) return
    setManual({
      brand_name: brandName.trim(),
      city_id: cityId,
      city_name: cityName,
      district_id: null,          // DB districts 表暂无数据，id 传 null
      district_name: districtName || null,
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

      {/* ── 第一步：基本信息 ── */}
      <section className="space-y-5">
        <h2 className="text-[13px] font-semibold text-neutral-800">第一步：填写店铺信息</h2>

        <div className="flex gap-4 items-start">
          {/* 封面图 */}
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
            {/* 店名 */}
            <div>
              <ManualLabel required>店名</ManualLabel>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="如 海底捞·紫竹桥店"
                className={`${MANUAL_CONTROL} mt-2 w-full`}
              />
            </div>

            {/* 分类 */}
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

      {/* ── 第二步：地图选点 + 位置信息 ── */}
      <section className="space-y-4 border-t border-neutral-100 pt-8">
        <h2 className="text-[13px] font-semibold text-neutral-800">第二步：选点与位置</h2>

        {/* 地图选点 */}
        <LocationPickerMap
          initialLat={initLat}
          initialLng={initLng}
          onPick={handleLocationPick}
        />

        {/* 城市 + 行政区（地图选点后自动填，也可手动微调） */}
        <div>
          <ManualLabel required hint="地图选点后自动填入，可手动调整">
            城市 · 行政区
          </ManualLabel>
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <ManualSelect
              value={cityId ?? ''}
              onChange={(v) => {
                setCityId(v || null)
                setDistrictName('')
              }}
              options={cities.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="城市"
            />
            {/* 行政区：从高德 API 动态拉取，选中后直接存区名 */}
            <select
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              disabled={!cityId || districtsLoading}
              className={`${MANUAL_CONTROL} cursor-pointer appearance-none disabled:cursor-not-allowed disabled:bg-neutral-100/70 disabled:text-neutral-400`}
            >
              <option value="">
                {districtsLoading ? '加载中…' : cityId ? '行政区' : '选城市'}
              </option>
              {amapDistricts.map((d) => (
                <option key={d.adcode} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 详细地址（地图选点后自动填，可编辑） */}
        <div>
          <ManualLabel hint="地图选点后自动填入，可编辑">详细地址</ManualLabel>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="填写街道门牌等信息"
            className={`${MANUAL_CONTROL} mt-2 w-full`}
          />
        </div>

        {/* 位置补充（选填） */}
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

      {/* ── 提交 ── */}
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
