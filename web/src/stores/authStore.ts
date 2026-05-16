import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

interface AuthState {
  user: User | null
  session: Session | null
  /** true after the initial getSession() + optional fixture sign-in completes */
  ready: boolean
  setSession: (session: Session | null) => void
  setReady: (ready: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  ready: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setReady: (ready) => set({ ready }),
}))
