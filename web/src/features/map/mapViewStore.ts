import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MapViewState {
  center: [number, number] | null
  zoom: number | null
  setView: (center: [number, number], zoom: number) => void
  resetView: () => void
}

export const useMapViewStore = create<MapViewState>()(
  persist(
    (set) => ({
      center: null,
      zoom: null,
      setView: (center, zoom) => set({ center, zoom }),
      resetView: () => set({ center: null, zoom: null }),
    }),
    { name: 'shijian:map-view' },
  ),
)
