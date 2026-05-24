import { useEffect, useRef, type ReactNode } from 'react'
import { useCityStore } from '@/features/city-picker/cityStore'
import { locateMatchedCityRow } from '@/features/city-picker/locateMatchedCityRow'
import { useCities } from '@/features/city-picker/useCities'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * 仅记录 GPS 定位到的城市到 locatedCity，不改变当前选中城市。
 * 用户可手动在城市选择器中切换。
 */
export function CityGeolocationBootstrap({
  children,
}: {
  children: ReactNode
}) {
  const { data: cities = [], isFetched } = useCities()

  const geoBootstrapDone = useCityStore((s) => s.geoBootstrapDone)
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

    if (cities.length === 0) {
      attempted.current = true
      markGeoBootstrapDone()
      return
    }

    attempted.current = true

    void (async () => {
      try {
        const result = await locateMatchedCityRow(cities)
        if (result.ok) {
          setLocatedCity(result.row.id, result.row.name)
        }
      } catch {
        // GPS 失败不报错，用户手动选城市即可
      } finally {
        markGeoBootstrapDone()
      }
    })()
  }, [
    isSupabaseConfigured,
    isFetched,
    cities,
    geoBootstrapDone,
    setLocatedCity,
    markGeoBootstrapDone,
  ])

  return <>{children}</>
}
