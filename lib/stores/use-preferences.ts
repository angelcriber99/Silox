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
  amoled: boolean
  defaultView: 'historical' | 'daily'
  sidebarCollapsed: boolean
  biometrics: boolean
  twoFactor: boolean
  tableDensity: 'compact' | 'relaxed'
  showPnlPercentOnly: boolean
  setHideBalances: (val: boolean) => void
  setCompactView: (val: boolean) => void
  setAccentColor: (color: AccentColor) => void
  setCelebrationMode: (val: boolean) => void
  setZenMode: (val: boolean) => void
  setSoundEffects: (val: boolean) => void
  setAmoled: (val: boolean) => void
  setDefaultView: (view: 'historical' | 'daily') => void
  setSidebarCollapsed: (val: boolean) => void
  setBiometrics: (val: boolean) => void
  setTwoFactor: (val: boolean) => void
  setTableDensity: (val: 'compact' | 'relaxed') => void
  setShowPnlPercentOnly: (val: boolean) => void
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
      amoled: false,
      defaultView: 'historical',
      sidebarCollapsed: false,
      biometrics: false,
      twoFactor: false,
      tableDensity: 'compact',
      showPnlPercentOnly: false,
      setHideBalances: (val) => set({ hideBalances: val }),
      setCompactView: (val) => set({ compactView: val }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCelebrationMode: (val) => set({ celebrationMode: val }),
      setZenMode: (val) => set({ zenMode: val }),
      setSoundEffects: (val) => set({ soundEffects: val }),
      setAmoled: (val) => set({ amoled: val }),
      setDefaultView: (view) => set({ defaultView: view }),
      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
      setBiometrics: (val) => set({ biometrics: val }),
      setTwoFactor: (val) => set({ twoFactor: val }),
      setTableDensity: (val) => set({ tableDensity: val }),
      setShowPnlPercentOnly: (val) => set({ showPnlPercentOnly: val }),
    }),
    {
      name: 'silox-preferences',
    }
  )
)
