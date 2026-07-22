"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePortfolioContext } from "@/lib/context/portfolio-context"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import type { EnrichedPosition, EventoRecurrente } from "@/lib/types"

import { SiloxInsights } from "@/components/dashboard/silox-insights"
import { AllocationChart } from "@/components/dashboard/allocation-chart"
import { PositionsTable } from "@/components/transactions/positions-table"
import { TopMovers } from "@/components/dashboard/top-movers"
import { UpcomingEvents } from "@/components/market/upcoming-events"
import { ZenDashboard } from "@/components/dashboard/zen-dashboard"
import { TopMetricsBar } from "@/components/dashboard/top-metrics-bar"
import { EditAssetModal } from "@/components/asset/edit-asset-modal"
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal"
import { AddEventModal } from "@/components/market/add-event-modal"
import { MobileDashboard } from "@/components/mobile/mobile-dashboard"
import { usePreferences } from "@/lib/stores/use-preferences"
import { PendingOrders } from "@/components/transactions/pending-orders"
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state"

export default function Home() {
  const queryClient = useQueryClient()
  const { positions, totals, isLoading, error, pricesUpdatedAt, marketState, pendingTxs, refetch } = usePortfolioContext()
  const { data: allTransactions } = useAllTransactions()
  const { zenMode } = usePreferences()

  const [addTxOpen, setAddTxOpen] = useState(false)
  const [editAssetOpen, setEditAssetOpen] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<EnrichedPosition | null>(null)
  const [editEventData, setEditEventData] = useState<EventoRecurrente | null>(null)

  const openTransactionModal = (position: EnrichedPosition) => {
    setSelectedPosition(position)
    setAddTxOpen(true)
  }
  const openEditAssetModal = (position: EnrichedPosition) => {
    setSelectedPosition(position)
    setEditAssetOpen(true)
  }

  if (error) {
    return <DashboardErrorState onRetry={() => void refetch()} />
  }

  return (
    <main className="min-h-full bg-transparent text-foreground flex flex-col flex-1 w-full relative">
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="md:hidden flex-1 w-full">
        <MobileDashboard
          positions={positions}
          totals={totals}
          isLoading={isLoading}
          marketState={marketState}
          pricesUpdatedAt={pricesUpdatedAt}
          pendingCount={pendingTxs.length}
        />
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col fixed inset-0 pt-8 z-0 bg-transparent overflow-hidden">
        {zenMode ? (
          <ZenDashboard positions={positions} marketState={marketState} />
        ) : (
          <div className="flex-1 flex flex-row overflow-hidden bg-transparent">
            
            {/* ── Left Sidebar (Dashboard Control Panel) ── */}
            <div className="w-[280px] lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col border-r glass-sidebar relative transition-all duration-300">
              {/* Subtle gradient background for the premium feel */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
              <div className="px-3 pt-3">
                <SiloxInsights positions={positions} totals={totals} />
              </div>
              
              <div className="grid flex-1 min-h-0 grid-rows-[auto_minmax(128px,0.8fr)_minmax(170px,1fr)] gap-3 overflow-hidden p-3">
                <AllocationChart positions={positions} marketState={marketState} />
                <TopMovers positions={positions.filter(p => p.tipo !== 'Liquidez')} marketState={marketState} />
                <UpcomingEvents
                  positions={positions.filter(p => p.tipo !== 'Liquidez')}
                  onAddEvent={() => { setEditEventData(null); setAddEventOpen(true) }}
                  onEditEvent={(data) => { setEditEventData(data); setAddEventOpen(true) }}
                />
              </div>
              
              {/* Price updated footer */}
              {pricesUpdatedAt && (
                <div className="mt-auto py-2 text-center text-[10px] text-muted-foreground/40">
                  Precios: {new Date(pricesUpdatedAt).toLocaleString("es-ES")}
                </div>
              )}
            </div>

            {/* ── Main Content (Positions Table) ── */}
            <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:py-5 lg:px-6 overflow-hidden relative">
              <div className="flex-shrink-0">
                <TopMetricsBar totals={totals} positions={positions} marketState={marketState} loading={isLoading} />
              </div>
              <div className="flex-1 flex flex-col glass-card border overflow-hidden">
                <div className="flex-shrink-0">
                  <PendingOrders transactions={pendingTxs} />
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <PositionsTable
                    positions={positions}
                    loading={isLoading}
                    onAddTransaction={openTransactionModal}
                    onEditAsset={openEditAssetModal}
                  />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <EditAssetModal position={selectedPosition} open={editAssetOpen} onOpenChange={setEditAssetOpen} />
      <AddTransactionModal position={selectedPosition} open={addTxOpen} onOpenChange={setAddTxOpen} />
      <AddEventModal
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        positions={positions}
        initialData={editEventData}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["upcoming-events"] })
        }}
      />
    </main>
  )
}
