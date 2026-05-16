/** 固定高度单行；宽度随字数横向拉长（flex 换行排布）。 */
export const CITY_PICKER_CHIP_LAYOUT =
  'inline-flex h-9 shrink-0 max-h-9 min-h-9 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold leading-none transition-colors'

export function cityPickerChipClass(selected: boolean): string {
  if (selected) {
    return `${CITY_PICKER_CHIP_LAYOUT} bg-orange-600 text-white ring-1 ring-orange-700`
  }
  return `${CITY_PICKER_CHIP_LAYOUT} bg-orange-50 text-orange-950 ring-1 ring-orange-100 active:bg-orange-100`
}
