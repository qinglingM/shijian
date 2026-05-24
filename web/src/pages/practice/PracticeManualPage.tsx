import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { LocationPickerMap, type LocationPickResult } from '@/features/map/LocationPickerMap'
import { CityPickerSheet } from '@/features/city-picker/CityPickerSheet'
import type { CitiesSourceStatus } from '@/features/city-picker/citiesSourceStatus'
import { useCities } from '@/features/city-picker/useCities'
import { useCategories } from '@/features/categories/useCategories'
import { useCityStore } from '@/features/city-picker/cityStore'
import { isSupabaseConfigured } from '@/lib/supabase'
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

// ── 通用底部弹出选择器 ──────────────────────────────────────────────────────────

function OptionSheet({
  open,
  onClose,
  title,
  options,
  value,
  onChange,
  emptyHint,
  loading,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  emptyHint?: string
  loading?: boolean
}) {
  if (!open) return null
  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        className="fixed inset-0 z-40 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[70dvh] max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl"
      >
        {/* 标题栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3.5">
          <p className="text-[15px] font-semibold text-neutral-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-orange-700 active:bg-orange-50"
          >
            完成
          </button>
        </div>
        {/* 列表 */}
        <div className="overflow-y-auto overscroll-contain px-3 py-2 pb-8">
          {loading ? (
            <p className="py-10 text-center text-sm text-neutral-400">加载中…</p>
          ) : options.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              {emptyHint ?? '暂无选项'}
            </p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  onClose()
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left transition-colors active:bg-neutral-50 ${
                  value === opt.value ? 'bg-orange-50' : ''
                }`}
              >
                <span
                  className={`text-[15px] ${
                    value === opt.value
                      ? 'font-semibold text-orange-700'
                      : 'font-normal text-neutral-900'
                  }`}
                >
                  {opt.label}
                </span>
                {value === opt.value && (
                  <Check size={16} strokeWidth={2.5} className="shrink-0 text-orange-600" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ── 选择器触发按钮（样式与 MANUAL_CONTROL 统一） ─────────────────────────────────

function SheetButton({
  label,
  placeholder,
  open,
  onClick,
  disabled,
}: {
  label?: string | null
  placeholder: string
  open?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="box-border flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-neutral-100 px-3 ring-1 ring-neutral-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50 active:bg-neutral-200/80 focus-visible:ring-2 focus-visible:ring-orange-400/55"
    >
      <span
        className={`min-w-0 flex-1 truncate text-left text-[13px] ${
          label ? 'text-neutral-900' : 'text-neutral-400'
        }`}
      >
        {label || placeholder}
      </span>
      <ChevronDown
        size={15}
        strokeWidth={2.2}
        className={`shrink-0 text-neutral-400 transition-transform duration-200 ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
  )
}

// ── 主表单 ─────────────────────────────────────────────────────────────────────

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

  // ── 数据源 ──────────────────────────────────────────────────────────────────
  const citiesQuery = useCities()
  const cities = citiesQuery.data ?? []
  const citiesSourceStatus = useMemo((): CitiesSourceStatus => {
    if (!isSupabaseConfigured) return { kind: 'no_supabase' }
    if (citiesQuery.isPending) return { kind: 'loading' }
    if (citiesQuery.isError)
      return { kind: 'error', message: (citiesQuery.error as Error)?.message ?? '' }
    if (cities.length === 0) return { kind: 'empty_db' }
    return { kind: 'ok' }
  }, [citiesQuery.isPending, citiesQuery.isError, citiesQuery.error, cities.length])

  const { data: categories = [] } = useCategories()

  const cityName = cities.find((c) => c.id === cityId)?.name ?? currentCityName ?? ''
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null

  // ── Sheet 开关 ──────────────────────────────────────────────────────────────
  const [citySheetOpen, setCitySheetOpen] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [districtSheetOpen, setDistrictSheetOpen] = useState(false)

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
      district_id: null,
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
              <div className="mt-2">
                <SheetButton
                  label={categoryName}
                  placeholder="选择分类"
                  open={categorySheetOpen}
                  onClick={() => setCategorySheetOpen(true)}
                />
              </div>
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
            <SheetButton
              label={cityId ? cityName : null}
              placeholder="城市"
              open={citySheetOpen}
              onClick={() => setCitySheetOpen(true)}
            />
            <SheetButton
              label={districtName || null}
              placeholder={cityId ? '行政区' : '选城市'}
              open={districtSheetOpen}
              onClick={() => {
                if (cityId && !districtsLoading) setDistrictSheetOpen(true)
              }}
              disabled={!cityId || districtsLoading}
            />
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

      {/* ── Sheets ── */}
      <CityPickerSheet
        open={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        cities={cities}
        sourceStatus={citiesSourceStatus}
        controlledCityId={cityId}
        controlledCityName={cityName}
        controlledShowsAllChina={false}
        onControlledCityChange={(id, name) => {
          setCityId(id)
          setDistrictName('')
          void name
        }}
      />

      <OptionSheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        title="选择分类"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={categoryId ?? ''}
        onChange={(v) => setCategoryId(v || null)}
        emptyHint="暂无分类数据"
      />

      <OptionSheet
        open={districtSheetOpen}
        onClose={() => setDistrictSheetOpen(false)}
        title="选择行政区"
        options={amapDistricts.map((d) => ({ value: d.name, label: d.name }))}
        value={districtName}
        onChange={setDistrictName}
        loading={districtsLoading}
        emptyHint="未能获取行政区列表"
      />
    </div>
  )
}
