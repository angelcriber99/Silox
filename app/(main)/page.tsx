"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePortfolioContext } from "@/lib/context/portfolio-context"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import type { EnrichedPosition, EventoRecurrente } from "@/lib/types"

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
          <div className="flex-1 flex flex-col overflow-y-auto bg-transparent p-4 lg:p-6 pb-20 custom-scrollbar">
            <div className="w-full max-w-[1600px] mx-auto space-y-4 lg:space-y-6">
              
              {/* ── Top Metrics ── */}
              <TopMetricsBar totals={totals} positions={positions} marketState={marketState} loading={isLoading} />
              
              {/* ── Visual Widgets Grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 min-h-[250px] lg:min-h-[300px]">
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
                <div className="text-right text-[10px] text-muted-foreground/40">
                  Precios: {new Date(pricesUpdatedAt).toLocaleString("es-ES")}
                </div>
              )}

              {/* ── Pending Orders ── */}
              {pendingTxs.length > 0 && (
                <div className="glass-card border rounded-2xl p-4">
                  <PendingOrders transactions={pendingTxs} />
                </div>
              )}

              {/* ── Positions Table ── */}
              <div className="glass-card border rounded-2xl overflow-hidden min-h-[500px]">
                <PositionsTable
                  positions={positions}
                  onAddTransaction={openTransactionModal}
                  onEditAsset={openEditAssetModal}
                />
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
