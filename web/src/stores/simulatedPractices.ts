import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tier } from '@/lib/db'

export interface SimulatedPracticeRecord {
  id: string
  tier: Tier
  restaurant: {
    id: string
    display_name: string
    cover_image_url: string | null
    category_id?: string | null
    category_name?: string | null
    city_id?: string | null
    city_name?: string | null
    latitude?: number | null
    longitude?: number | null
    amap_mid_category?: string | null
    amap_small_category?: string | null
  }
}

interface SimulatedPracticesState {
  records: SimulatedPracticeRecord[]
  addRecord: (record: Omit<SimulatedPracticeRecord, 'id'>) => void
}

function randomId() {
  return `sim_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export const useSimulatedPractices = create<SimulatedPracticesState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record) =>
        set((s) => ({
          records: [{ ...record, id: randomId() }, ...s.records],
        })),
    }),
    { name: 'shijian:simulated-practices' },
  ),
)
