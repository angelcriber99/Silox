import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'indigo' | 'teal' | 'pink'
export type Language = 'es' | 'en' | 'fr' | 'de'
export type RefreshInterval = 5_000 | 10_000 | 15_000 | 30_000 | 60_000
export type DashboardDensity = 'auto' | 'compact' | 'comfortable'
export type DashboardSort = 'value' | 'day' | 'session' | 'pnl'

interface PreferencesState {
  language: Language
  hideBalances: boolean
  compactView: boolean
  accentColor: AccentColor
  celebrationMode: boolean
  zenMode: boolean
  amoled: boolean
  defaultView: 'historical' | 'daily'
  sidebarCollapsed: boolean
  biometrics: boolean
  twoFactor: boolean
  tableDensity: 'compact' | 'relaxed'
  showPnlPercentOnly: boolean
  pushNotifs: boolean
  emailNotifs: boolean
  priceAlerts: boolean
  weeklyReport: boolean
  dividendAlerts: boolean
  refreshInterval: RefreshInterval
  pauseUpdatesWhenHidden: boolean
  dashboardDensity: DashboardDensity
  dashboardPageSize: 'auto' | 5 | 8 | 12
  dashboardSort: DashboardSort
  showAssetNames: boolean
  showAssetTypes: boolean
  showSessionPerformance: boolean
  showDailyPerformance: boolean
  showTotalPerformance: boolean
  showMarketStatus: boolean
  showLastUpdate: boolean
  fontScale: 'small' | 'normal' | 'large'
  setLanguage: (lang: Language) => void
  setHideBalances: (val: boolean) => void
  setCompactView: (val: boolean) => void
  setAccentColor: (color: AccentColor) => void
  setCelebrationMode: (val: boolean) => void
  setZenMode: (val: boolean) => void
  setAmoled: (val: boolean) => void
  setDefaultView: (view: 'historical' | 'daily') => void
  setSidebarCollapsed: (val: boolean) => void
  setBiometrics: (val: boolean) => void
  setTwoFactor: (val: boolean) => void
  setTableDensity: (val: 'compact' | 'relaxed') => void
  setShowPnlPercentOnly: (val: boolean) => void
  setPushNotifs: (val: boolean) => void
  setEmailNotifs: (val: boolean) => void
  setPriceAlerts: (val: boolean) => void
  setWeeklyReport: (val: boolean) => void
  setDividendAlerts: (val: boolean) => void
  setRefreshInterval: (val: RefreshInterval) => void
  setPauseUpdatesWhenHidden: (val: boolean) => void
  setDashboardDensity: (val: DashboardDensity) => void
  setDashboardPageSize: (val: 'auto' | 5 | 8 | 12) => void
  setDashboardSort: (val: DashboardSort) => void
  setShowAssetNames: (val: boolean) => void
  setShowAssetTypes: (val: boolean) => void
  setShowSessionPerformance: (val: boolean) => void
  setShowDailyPerformance: (val: boolean) => void
  setShowTotalPerformance: (val: boolean) => void
  setShowMarketStatus: (val: boolean) => void
  setShowLastUpdate: (val: boolean) => void
  setFontScale: (val: 'small' | 'normal' | 'large') => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'es',
      hideBalances: false,
      compactView: false,
      accentColor: 'blue',
      celebrationMode: true,
      zenMode: false,
      amoled: false,
      defaultView: 'historical',
      sidebarCollapsed: false,
      biometrics: false,
      twoFactor: false,
      tableDensity: 'compact',
      showPnlPercentOnly: false,
      pushNotifs: true,
      emailNotifs: true,
      priceAlerts: true,
      weeklyReport: false,
      dividendAlerts: true,
      refreshInterval: 15_000,
      pauseUpdatesWhenHidden: true,
      dashboardDensity: 'auto',
      dashboardPageSize: 'auto',
      dashboardSort: 'value',
      showAssetNames: true,
      showAssetTypes: true,
      showSessionPerformance: true,
      showDailyPerformance: true,
      showTotalPerformance: true,
      showMarketStatus: true,
      showLastUpdate: true,
      fontScale: 'normal',
      setLanguage: (lang) => set({ language: lang }),
      setHideBalances: (val) => set({ hideBalances: val }),
      setCompactView: (val) => set({ compactView: val }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCelebrationMode: (val) => set({ celebrationMode: val }),
      setZenMode: (val) => set({ zenMode: val }),
      setAmoled: (val) => set({ amoled: val }),
      setDefaultView: (view) => set({ defaultView: view }),
      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
      setBiometrics: (val) => set({ biometrics: val }),
      setTwoFactor: (val) => set({ twoFactor: val }),
      setTableDensity: (val) => set({ tableDensity: val }),
      setShowPnlPercentOnly: (val) => set({ showPnlPercentOnly: val }),
      setPushNotifs: (val) => set({ pushNotifs: val }),
      setEmailNotifs: (val) => set({ emailNotifs: val }),
      setPriceAlerts: (val) => set({ priceAlerts: val }),
      setWeeklyReport: (val) => set({ weeklyReport: val }),
      setDividendAlerts: (val) => set({ dividendAlerts: val }),
      setRefreshInterval: (val) => set({ refreshInterval: val }),
      setPauseUpdatesWhenHidden: (val) => set({ pauseUpdatesWhenHidden: val }),
      setDashboardDensity: (val) => set({ dashboardDensity: val }),
      setDashboardPageSize: (val) => set({ dashboardPageSize: val }),
      setDashboardSort: (val) => set({ dashboardSort: val }),
      setShowAssetNames: (val) => set({ showAssetNames: val }),
      setShowAssetTypes: (val) => set({ showAssetTypes: val }),
      setShowSessionPerformance: (val) => set({ showSessionPerformance: val }),
      setShowDailyPerformance: (val) => set({ showDailyPerformance: val }),
      setShowTotalPerformance: (val) => set({ showTotalPerformance: val }),
      setShowMarketStatus: (val) => set({ showMarketStatus: val }),
      setShowLastUpdate: (val) => set({ showLastUpdate: val }),
      setFontScale: (val) => set({ fontScale: val }),
    }),
    {
      name: 'silox-preferences',
    }
  )
)
