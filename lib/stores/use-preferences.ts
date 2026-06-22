import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferencesState {
  hideBalances: boolean
  compactView: boolean
  setHideBalances: (val: boolean) => void
  setCompactView: (val: boolean) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hideBalances: false,
      compactView: false,
      setHideBalances: (val) => set({ hideBalances: val }),
      setCompactView: (val) => set({ compactView: val }),
    }),
    {
      name: 'silox-preferences',
    }
  )
)
