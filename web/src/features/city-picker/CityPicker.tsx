import { useMemo, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cityNavbarAbbrev } from '@/features/city-picker/cityNavbarAbbrev'
import { useCities } from '@/features/city-picker/useCities'
import { useCityStore } from '@/features/city-picker/cityStore'
import { CityPickerSheet } from '@/features/city-picker/CityPickerSheet'
import type { CitiesSourceStatus } from '@/features/city-picker/citiesSourceStatus'
import { isSupabaseConfigured } from '@/lib/supabase'

export type CityPickerVariant = 'navbar' | 'field' | 'practiceRow'

interface CityPickerProps {
  variant?: CityPickerVariant
  /** 受控模式：由外部管理城市状态，不读写全局 cityStore */
  controlledCityId?: string | null
  controlledCityName?: string
  onCityChange?: (cityId: string | null, cityName: string) => void
  onAllChina?: () => void
}

export function CityPicker({
  variant = 'navbar',
  controlledCityId,
  controlledCityName,
  onCityChange,
  onAllChina,
}: CityPickerProps) {
  const [open, setOpen] = useState(false)

  const isControlled = onCityChange !== undefined || onAllChina !== undefined

  const citiesQuery = useCities()
  const cities = citiesQuery.data ?? []

  const sourceStatus: CitiesSourceStatus = useMemo(() => {
    if (!isSupabaseConfigured) return { kind: 'no_supabase' }
    if (citiesQuery.isPending) return { kind: 'loading' }
    if (citiesQuery.isError) {
      const e = citiesQuery.error as Error | undefined
      return {
        kind: 'error',
        message: e?.message ?? String(citiesQuery.error),
      }
    }
    if (cities.length === 0) return { kind: 'empty_db' }
    return { kind: 'ok' }
  }, [
    citiesQuery.isPending,
    citiesQuery.isError,
    citiesQuery.error,
    cities.length,
  ])

  const storeTierMapShowsAllChina = useCityStore((s) => s.tierMapShowsAllChina)
  const storeGeoBootstrapDone = useCityStore((s) => s.geoBootstrapDone)
  const storeCityId = useCityStore((s) => s.cityId)
  const storeCityName = useCityStore((s) => s.cityName)

  const showsAllChina = isControlled
    ? controlledCityId == null
    : storeTierMapShowsAllChina
  const currentCityName = isControlled
    ? (controlledCityName ?? '北京')
    : storeCityName
  const currentCityId = isControlled
    ? (controlledCityId ?? null)
    : storeCityId
  const geoBootstrapDone = isControlled ? true : storeGeoBootstrapDone

  const sortedCities = useMemo(() => {
    return [...cities].sort(
      (a, b) =>
        (a.name_pinyin ?? a.name).localeCompare(
          b.name_pinyin ?? b.name,
          'zh-Hans-CN',
          { sensitivity: 'base' },
        ) || a.name.localeCompare(b.name, 'zh-Hans-CN'),
    )
  }, [cities])

  /** 顶栏 / 食鉴行：缩写；全国模式显示「全部」；表单行用全称 */
  const triggerLabelShown =
    variant === 'field'
      ? showsAllChina
        ? '点选搜索城市（食鉴图为全国时不限定）'
        : !geoBootstrapDone && !currentCityId
          ? '正在定位默认城市…'
          : currentCityName
      : showsAllChina
        ? '全部'
        : !geoBootstrapDone && !currentCityId
          ? '定位中…'
          : cityNavbarAbbrev(currentCityName)

  /** 播报 / 语义 */
  const triggerAriaAndTitle =
    variant === 'field' || variant === 'practiceRow'
      ? showsAllChina
        ? '选择要搜索门店的地级市；当前为食鉴图全国浏览'
        : !geoBootstrapDone && !currentCityId
          ? '正在根据定位推断默认城市'
          : `当前搜索城市：${currentCityName}，点击可更换`
      : showsAllChina
        ? '全部：食鉴图不按城市收窄'
        : !geoBootstrapDone && !currentCityId
          ? '正在根据定位推断城市'
          : currentCityName

  return (
    <>
      <div className={cn('relative shrink-0', variant === 'field' && 'w-full')}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={triggerAriaAndTitle}
          title={triggerAriaAndTitle}
          className={cn(
            'text-neutral-900 transition-colors',
            (variant === 'navbar' || variant === 'practiceRow') &&
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold tracking-tight shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 active:scale-[0.97]',
            variant === 'navbar' && 'max-w-[42vw] md:max-w-none',
            variant === 'field' &&
              'flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-xl border border-orange-200/85 bg-white px-3 py-2.5 text-left shadow-sm shadow-orange-900/[0.05] hover:border-orange-300/90 hover:bg-orange-50/35 active:scale-[0.99]',
          )}
        >
          {variant === 'field' ? (
            <>
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                <MapPin
                  className="size-[1.0625rem] shrink-0 text-amber-600/95"
                  aria-hidden
                  strokeWidth={2}
                />
                <span className="min-h-[1em] min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-950">
                  {triggerLabelShown}
                </span>
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2.25}
                className={cn(
                  'shrink-0 text-orange-950/35 transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </>
          ) : (
            <>
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                <MapPin
                  className="size-3 shrink-0 text-amber-600/95"
                  aria-hidden
                  strokeWidth={2}
                />
                <span className="inline-block min-h-[1em] min-w-0 max-w-[5rem] truncate text-sm font-semibold leading-snug tracking-tight sm:max-w-[5.5rem]">
                  {triggerLabelShown}
                </span>
              </span>
              <ChevronDown
                size={15}
                strokeWidth={2.25}
                className={cn(
                  'shrink-0 text-neutral-400 transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </>
          )}
        </button>
      </div>
      <CityPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        cities={sortedCities}
        sourceStatus={sourceStatus}
        controlledCityId={isControlled ? controlledCityId : undefined}
        controlledCityName={isControlled ? controlledCityName : undefined}
        controlledShowsAllChina={isControlled ? showsAllChina : undefined}
        onControlledCityChange={onCityChange}
        onControlledAllChina={onAllChina}
      />
    </>
  )
}
