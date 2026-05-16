import { useMemo, useState } from 'react'
import { Loader2, LocateFixed } from 'lucide-react'
import type { CityRow } from '@/lib/db'
import { cityPickerChipClass } from '@/features/city-picker/cityPickerChipClass'
import { cityPickerChipDisplayName } from '@/features/city-picker/cityPickerSheetLabel'
import { useCityStore } from '@/features/city-picker/cityStore'
import { locateMatchedCityRow } from '@/features/city-picker/locateMatchedCityRow'
import { cn } from '@/lib/utils'

type CurrentLocationCitySectionProps = {
  cities: CityRow[]
  /** 城市列表尚未就绪（加载中 / 无数据） */
  disabled?: boolean
  /** 当前已选城市 id（用于高亮芯片；食鉴图为全国时不高亮具体城） */
  selectedCityId: string | null
  tierMapShowsAllChina?: boolean
  onSelectCity: (c: CityRow) => void
  /** 外层容器 class（默认下边距较大，表单内可收窄） */
  className?: string
}

/**
 * 「当前定位」单列：展示 GPS 逆地理匹配到的唯一地级市，与选中城市无关时可单独刷新。
 */
export function CurrentLocationCitySection({
  cities,
  disabled = false,
  selectedCityId,
  tierMapShowsAllChina = false,
  onSelectCity,
  className,
}: CurrentLocationCitySectionProps) {
  const locatedCityId = useCityStore((s) => s.locatedCityId)
  const locatedCityName = useCityStore((s) => s.locatedCityName)
  const setLocatedCity = useCityStore((s) => s.setLocatedCity)

  const [busy, setBusy] = useState(false)

  const locatedRow = useMemo(() => {
    if (!locatedCityId) return null
    return cities.find((c) => c.id === locatedCityId) ?? null
  }, [cities, locatedCityId])

  async function refresh() {
    if (disabled || cities.length === 0 || busy) return
    setBusy(true)
    try {
      const r = await locateMatchedCityRow(cities)
      if (r.ok) setLocatedCity(r.row.id, r.row.name)
    } finally {
      setBusy(false)
    }
  }

  const chipSelected = Boolean(
    locatedRow && !tierMapShowsAllChina && selectedCityId === locatedRow.id,
  )

  const listBlocked = disabled || cities.length === 0

  return (
    <div className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center gap-2 pr-6">
        <LocateFixed
          className="size-3.5 shrink-0 text-orange-600/90"
          aria-hidden
          strokeWidth={2.25}
        />
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          当前定位
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={listBlocked || busy}
          className="ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-orange-700 active:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '定位中…' : '刷新'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pr-6">
        {busy && !locatedRow ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
            <Loader2 className="size-3.5 animate-spin text-orange-600/80" aria-hidden />
            正在获取定位…
          </span>
        ) : locatedRow ? (
          <button
            type="button"
            onClick={() => onSelectCity(locatedRow)}
            disabled={listBlocked}
            title={locatedRow.name}
            className={cityPickerChipClass(chipSelected)}
          >
            {cityPickerChipDisplayName(locatedRow)}
          </button>
        ) : (
          <p className="text-[12px] leading-relaxed text-neutral-500">
            {listBlocked
              ? '载入城市列表后可使用定位'
              : '暂无定位结果，请开启定位权限后点「刷新」'}
          </p>
        )}
      </div>

      {locatedCityName && !locatedRow && !busy && !listBlocked ? (
        <p className="mt-1 text-[11px] text-neutral-400">
          已记录「{locatedCityName}」，但列表中暂无对应条目，请刷新定位或核对数据
        </p>
      ) : null}

      {!locatedRow && !busy && !listBlocked ? (
        <p className="mt-1 text-[10px] text-neutral-400">
          依据设备 GPS；若在热门中出现同一座城，下方热门列表会隐藏重复项
        </p>
      ) : null}
    </div>
  )
}
