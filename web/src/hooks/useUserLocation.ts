import { useEffect, useState } from 'react'

export interface UserLocation {
  lat: number
  lng: number
}

export function useUserLocation(): UserLocation | null {
  const [loc, setLoc] = useState<UserLocation | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* 拒绝或失败时静默忽略，排序降级为默认顺序 */ },
      { timeout: 5000, maximumAge: 60_000 },
    )
  }, [])

  return loc
}
