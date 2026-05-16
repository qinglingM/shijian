import { useEffect, useRef, type ReactNode } from 'react'
import { useCityStore } from '@/features/city-picker/cityStore'
import { locateMatchedCityRow } from '@/features/city-picker/locateMatchedCityRow'
import { useCities } from '@/features/city-picker/useCities'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * 未直连 Supabase 时直接标记首轮推断完成；
 * 有 cities 时在首轮尝试浏览器定位并按全国城市列表匹配；失败且无 cityId 时回退到北京。
 */
export function CityGeolocationBootstrap({
  children,
}: {
  children: ReactNode
}) {
  const { data: cities = [], isFetched } = useCities()

  const geoBootstrapDone = useCityStore((s) => s.geoBootstrapDone)
  const cityId = useCityStore((s) => s.cityId)
  const setConcreteCity = useCityStore((s) => s.setConcreteCity)
  const setLocatedCity = useCityStore((s) => s.setLocatedCity)
  const markGeoBootstrapDone = useCityStore((s) => s.markGeoBootstrapDone)

  const attempted = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (!geoBootstrapDone) markGeoBootstrapDone()
      return
    }

    if (geoBootstrapDone) return
    if (!isFetched || attempted.current) return

    function pickFallbackWhenNoCityId() {
      if (cityId) return
      const bj =
        cities.find((c) => c.name === '北京') ??
        cities.find((c) => c.name.endsWith('北京')) ??
        cities[0]
      if (bj) setConcreteCity(bj.id, bj.name)
    }

    if (cities.length === 0) {
      attempted.current = true
      pickFallbackWhenNoCityId()
      markGeoBootstrapDone()
      return
    }

    attempted.current = true

    void (async () => {
      try {
        const result = await locateMatchedCityRow(cities)
        if (result.ok) {
          setLocatedCity(result.row.id, result.row.name)
          setConcreteCity(result.row.id, result.row.name)
        } else {
          pickFallbackWhenNoCityId()
        }
      } catch {
        pickFallbackWhenNoCityId()
      } finally {
        markGeoBootstrapDone()
      }
    })()
    // geoBootstrapDone 仅首轮；attempted + store 防抖
  }, [
    isSupabaseConfigured,
    isFetched,
    cities,
    geoBootstrapDone,
    cityId,
    setConcreteCity,
    setLocatedCity,
    markGeoBootstrapDone,
  ])

  return <>{children}</>
}
