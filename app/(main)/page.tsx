"use client"

import { useState } from "react"
import { Plus, Activity } from "lucide-react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"

import { PortfolioSummary } from "@/components/dashboard/portfolio-summary"
import { AllocationChart } from "@/components/dashboard/allocation-chart"
import { PositionsTable } from "@/components/transactions/positions-table"
import { TopMovers } from "@/components/dashboard/top-movers"
import { UpcomingEvents } from "@/components/market/upcoming-events"
import { MarketTicker } from "@/components/market/market-ticker"
import { EditAssetModal } from "@/components/asset/edit-asset-modal"
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal"
import { AddEventModal } from "@/components/market/add-event-modal"
import { MobileDashboard } from "@/components/mobile/mobile-dashboard"
import { usePreferences } from "@/lib/stores/use-preferences"
import { ZenDashboard } from "@/components/dashboard/zen-dashboard"
import { Eye } from "lucide-react"

export default function Home() {
  const { positions, totals, isLoading } = usePortfolio()
  const { zenMode, setZenMode } = usePreferences()

  // Modals
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [editAssetOpen, setEditAssetOpen] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<EnrichedPosition | null>(null)
  const [editEventData, setEditEventData] = useState<any>(null)

  const openTransactionModal = (position: EnrichedPosition) => {
    setSelectedPosition(position)
    setAddTxOpen(true)
  }

  const openEditAssetModal = (position: EnrichedPosition) => {
    setSelectedPosition(position)
    setEditAssetOpen(true)
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {zenMode && (
        <ZenDashboard totals={totals} positions={positions} />
      )}

      {/* ── Mobile Dashboard ─────────────────── */}
      <div className="md:hidden">
        <MobileDashboard
          positions={positions}
          totals={totals}
          isLoading={isLoading}
        />
      </div>

      {/* ── Desktop Dashboard ────────────────── */}
      <div className="hidden md:flex md:flex-col md:flex-1">
        {/* Ticker Bar */}
        <MarketTicker positions={positions} />

        {/* ── Content ────────────────────────────── */}
        <div className="flex-1 mx-auto w-full px-6 py-6 space-y-6 max-w-7xl relative">
          
          {/* Botón rápido Modo ZEN */}
          <div className="absolute right-6 top-6 z-10">
            <button
              onClick={() => setZenMode(true)}
              className="p-2.5 rounded-full bg-card border border-border shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-all duration-300 group"
              title="Activar Modo ZEN"
            >
              <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* KPI Cards */}
          <PortfolioSummary totals={totals} loading={isLoading} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <AllocationChart positions={positions} />
            </div>
            
            <div className="lg:col-span-1 space-y-6 flex flex-col">
              <TopMovers positions={positions} />
              <div>
                <UpcomingEvents 
                  positions={positions} 
                  onAddEvent={() => { setEditEventData(null); setAddEventOpen(true); }} 
                  onEditEvent={(data) => { setEditEventData(data); setAddEventOpen(true); }}
                />
              </div>
            </div>
          </div>

          <PositionsTable
            positions={positions}
            loading={isLoading}
            onAddTransaction={openTransactionModal}
            onEditAsset={openEditAssetModal}
          />
        </div>
      </div>

      {/* ── Modals ─────────────────────────────── */}
      <EditAssetModal
        position={selectedPosition}
        open={editAssetOpen}
        onOpenChange={setEditAssetOpen}
      />
      <AddTransactionModal
        position={selectedPosition}
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
      />
      <AddEventModal
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        positions={positions}
        initialData={editEventData}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </main>
  )
}
