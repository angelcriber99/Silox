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
import { SiloxInsights } from "@/components/dashboard/silox-insights"

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
        {!zenMode && <MarketTicker positions={positions} />}

        {/* ── Content ────────────────────────────── */}
        <div className={`flex-1 mx-auto w-full px-6 py-6 space-y-6 ${zenMode ? 'max-w-4xl pt-20' : 'max-w-7xl'}`}>

          {/* Insights */}
          {!zenMode && <SiloxInsights positions={positions} totals={totals} />}

          {/* KPI Cards */}
          <PortfolioSummary totals={totals} loading={isLoading} />

          {/* Charts Row */}
          <div className={`grid grid-cols-1 ${zenMode ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
            <div className={`${zenMode ? 'col-span-1' : 'lg:col-span-2'} flex flex-col gap-6`}>
              <AllocationChart positions={positions} />
            </div>
            
            {!zenMode && (
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
            )}
          </div>

          {!zenMode && (
            <PositionsTable
              positions={positions}
              loading={isLoading}
              onAddTransaction={openTransactionModal}
              onEditAsset={openEditAssetModal}
            />
          )}
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
