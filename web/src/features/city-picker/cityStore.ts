import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CitySlice {
  /** 食鉴图 / 搜索 / 地图是否不按城市收窄 */
  tierMapShowsAllChina: boolean
  /** 录入 / POI（始终指向具体地级市 id） */
  cityId: string | null
  cityName: string
  geoBootstrapDone: boolean
  /**
   * 最近一次 GPS 逆地理并成功命中 `cities` 表的条目（可与当前手动选中的城市不同）。
   */
  locatedCityId: string | null
  locatedCityName: string | null
}

interface CityActions {
  setConcreteCity: (id: string, name: string) => void
  setTierMapShowsAllChina: () => void
  markGeoBootstrapDone: () => void
  setLocatedCity: (id: string | null, name: string | null) => void
}

type CityState = CitySlice & CityActions

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      tierMapShowsAllChina: false,
      cityId: null,
      cityName: '北京',
      geoBootstrapDone: false,
      locatedCityId: null,
      locatedCityName: null,
      setConcreteCity: (id, name) =>
        set({ cityId: id, cityName: name, tierMapShowsAllChina: false }),
      setTierMapShowsAllChina: () => set({ tierMapShowsAllChina: true }),
      markGeoBootstrapDone: () => set({ geoBootstrapDone: true }),
      setLocatedCity: (id, name) => set({ locatedCityId: id, locatedCityName: name }),
    }),
    {
      name: 'shijian:city',
      version: 3,
      partialize: (s): CitySlice => ({
        tierMapShowsAllChina: s.tierMapShowsAllChina,
        cityId: s.cityId,
        cityName: s.cityName,
        geoBootstrapDone: s.geoBootstrapDone,
        locatedCityId: s.locatedCityId,
        locatedCityName: s.locatedCityName,
      }),
      migrate: (persisted, version) => {
        const p = persisted as Partial<
          Pick<
            CitySlice,
            | 'tierMapShowsAllChina'
            | 'cityId'
            | 'cityName'
            | 'geoBootstrapDone'
            | 'locatedCityId'
            | 'locatedCityName'
          >
        > & {
          /** v1 旧持久化片段 */
          setCity?: unknown
        }
        void p.setCity
        if (version < 2) {
          return {
            tierMapShowsAllChina: false,
            cityId: p.cityId ?? null,
            cityName: (p.cityName as string | undefined) ?? '北京',
            geoBootstrapDone: Boolean(p.geoBootstrapDone ?? false),
            locatedCityId: null,
            locatedCityName: null,
          } satisfies CitySlice
        }
        if (version < 3) {
          return {
            tierMapShowsAllChina: Boolean(p.tierMapShowsAllChina ?? false),
            cityId: p.cityId ?? null,
            cityName: (p.cityName as string | undefined) ?? '北京',
            geoBootstrapDone: Boolean(p.geoBootstrapDone ?? false),
            locatedCityId: null,
            locatedCityName: null,
          } satisfies CitySlice
        }
        return {
          tierMapShowsAllChina: Boolean(p.tierMapShowsAllChina ?? false),
          cityId: p.cityId ?? null,
          cityName: (p.cityName as string | undefined) ?? '北京',
          geoBootstrapDone: Boolean(p.geoBootstrapDone ?? false),
          locatedCityId: p.locatedCityId ?? null,
          locatedCityName: p.locatedCityName ?? null,
        } satisfies CitySlice
      },
    },
  ),
)
