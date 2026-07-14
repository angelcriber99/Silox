"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import type { EnrichedPosition, EventoRecurrente } from "@/lib/types"

import { PortfolioSummary } from "@/components/dashboard/portfolio-summary"
import { AllocationChart } from "@/components/dashboard/allocation-chart"
import { PositionsTable } from "@/components/transactions/positions-table"
import { TopMovers } from "@/components/dashboard/top-movers"
import { UpcomingEvents } from "@/components/market/upcoming-events"
import { ZenDashboard } from "@/components/dashboard/zen-dashboard"
import { EditAssetModal } from "@/components/asset/edit-asset-modal"
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal"
import { AddEventModal } from "@/components/market/add-event-modal"
import { MobileDashboard } from "@/components/mobile/mobile-dashboard"
import { usePreferences } from "@/lib/stores/use-preferences"
import { PendingOrders } from "@/components/transactions/pending-orders"
import { PullToRefresh } from "@/components/layout/pull-to-refresh"
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state"

export default function Home() {
  const queryClient = useQueryClient()
  const { positions, totals, isLoading, error, pricesUpdatedAt, marketState, pendingTxs, refetch } = usePortfolio()
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
    <main className="min-h-full bg-background text-foreground flex flex-col flex-1 w-full">
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <PullToRefresh onRefresh={async () => { await refetch() }}>
          <MobileDashboard
            positions={positions}
            totals={totals}
            isLoading={isLoading}
            marketState={marketState}
          />
        </PullToRefresh>
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col fixed inset-0 z-0 bg-background overflow-hidden">
        {zenMode ? (
          <ZenDashboard positions={positions} marketState={marketState} />
        ) : (
          <div className="flex-1 flex flex-row overflow-hidden bg-background">
            
            {/* ── Left Sidebar (Dashboard Control Panel) ── */}
            <div className="w-[360px] xl:w-[380px] flex-shrink-0 flex flex-col border-r border-border/20 overflow-y-auto custom-scrollbar bg-background relative">
              {/* Subtle gradient background for the premium feel */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
              <PortfolioSummary
                totals={totals}
                positions={positions}
                transactions={allTransactions}
                loading={isLoading}
                pendingTxs={pendingTxs}
                variant="sidebar"
              />
              
              <div className="flex flex-col gap-6 p-4">
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
                <div className="mt-auto text-[10px] text-muted-foreground/40 text-center py-4">
                  Precios: {new Date(pricesUpdatedAt).toLocaleString("es-ES")}
                </div>
              )}
            </div>

            {/* ── Main Content (Positions Table) ── */}
            <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:py-5 lg:px-6 overflow-hidden relative">
              <div className="flex-1 flex flex-col bg-card rounded-xl border border-border/30 shadow-sm overflow-hidden">
                <div className="flex-shrink-0">
                  <PendingOrders transactions={pendingTxs} />
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
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
