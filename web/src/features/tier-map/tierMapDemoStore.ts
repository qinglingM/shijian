import { create } from 'zustand'

export interface TierMapDemoStore {
  manualShowDemo: boolean
  setManualShowDemo: (v: boolean) => void
}

export const useTierMapDemoStore = create<TierMapDemoStore>((set) => ({
  manualShowDemo: false,
  setManualShowDemo: (manualShowDemo) => set({ manualShowDemo }),
}))
