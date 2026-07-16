"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import type { EnrichedPosition, EventoRecurrente } from "@/lib/types"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { MinimalDashboard } from "@/components/dashboard/minimal-dashboard"
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state"
import { PullToRefresh } from "@/components/layout/pull-to-refresh"
import { EditAssetModal } from "@/components/asset/edit-asset-modal"
import { AddEventModal } from "@/components/market/add-event-modal"
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal"
import { PendingOrders } from "@/components/transactions/pending-orders"

export default function Home() {
  const queryClient = useQueryClient()
  const { positions, totals, isLoading, error, pricesUpdatedAt, marketState, pendingTxs, refetch } = usePortfolio()

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

  if (error) return <DashboardErrorState onRetry={() => void refetch()} />

  return (
    <main className="min-h-full w-full flex-1 bg-background text-foreground">
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        <div className="mx-auto w-full max-w-[1480px] px-4 pt-4 sm:px-6 lg:px-8">
          <PendingOrders transactions={pendingTxs} />
        </div>

        <MinimalDashboard
          positions={positions}
          totals={totals}
          loading={isLoading}
          marketState={marketState}
          pricesUpdatedAt={pricesUpdatedAt}
          onAddTransaction={openTransactionModal}
          onEditAsset={openEditAssetModal}
          onAddEvent={() => {
            setEditEventData(null)
            setAddEventOpen(true)
          }}
          onEditEvent={(event) => {
            setEditEventData(event)
            setAddEventOpen(true)
          }}
        />
      </PullToRefresh>

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
