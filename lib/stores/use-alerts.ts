import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PriceAlert {
  id: string
  ticker: string
  targetPrice: number
  condition: 'above' | 'below'
  triggered: boolean
}

interface AlertsState {
  alerts: PriceAlert[]
  addAlert: (alert: Omit<PriceAlert, 'id' | 'triggered'>) => void
  removeAlert: (id: string) => void
  markTriggered: (id: string) => void
}

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      alerts: [],
      addAlert: (alert) => set((state) => ({
        alerts: [...state.alerts, { ...alert, id: Math.random().toString(36).substr(2, 9), triggered: false }]
      })),
      removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id)
      })),
      markTriggered: (id) => set((state) => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, triggered: true } : a)
      }))
    }),
    {
      name: 'silox-alerts'
    }
  )
)
