import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber'

interface PreferencesState {
  hideBalances: boolean
  compactView: boolean
  accentColor: AccentColor
  celebrationMode: boolean
  zenMode: boolean
  soundEffects: boolean
  setHideBalances: (val: boolean) => void
  setCompactView: (val: boolean) => void
  setAccentColor: (color: AccentColor) => void
  setCelebrationMode: (val: boolean) => void
  setZenMode: (val: boolean) => void
  setSoundEffects: (val: boolean) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hideBalances: false,
      compactView: false,
      accentColor: 'blue',
      celebrationMode: true,
      zenMode: false,
      soundEffects: true,
      setHideBalances: (val) => set({ hideBalances: val }),
      setCompactView: (val) => set({ compactView: val }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCelebrationMode: (val) => set({ celebrationMode: val }),
      setZenMode: (val) => set({ zenMode: val }),
      setSoundEffects: (val) => set({ soundEffects: val }),
    }),
    {
      name: 'silox-preferences',
    }
  )
)
