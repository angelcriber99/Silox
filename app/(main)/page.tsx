"use client"

import { useState } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import type { EnrichedPosition } from "@/lib/types"

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

export default function Home() {
  const { positions, totals, isLoading, pricesUpdatedAt, marketState, pendingTxs } = usePortfolio()
  const { data: allTransactions } = useAllTransactions()
  const { zenMode } = usePreferences()

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

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <MobileDashboard
          positions={positions}
          totals={totals}
          isLoading={isLoading}
          marketState={marketState}
        />
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col md:flex-1">
        {zenMode ? (
          <ZenDashboard positions={positions} marketState={marketState} />
        ) : (
          <div className="flex-1 flex flex-col">
            
            <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
              <div className="text-rose-400 font-bold">
                🛠️ Botón Mágico de Antigravity
              </div>
              <button 
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]"
                onClick={async () => {
                  const { toast } = await import("sonner")
                  const liquidezPos = positions.find(p => p.tipo === "Liquidez")
                  if (!liquidezPos) { toast.error("No tienes activo de Liquidez"); return; }
                  try {
                    const { createClient } = await import('@/lib/supabase/client')
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if(!user) return
                    await supabase.from('transacciones').insert([{
                      activo_id: liquidezPos.activo_id,
                      tipo_operacion: "Venta",
                      estado: "Completada",
                      cantidad: 5007.20,
                      precio_unitario: 1,
                      comision: 0,
                      fecha: new Date().toISOString().split("T")[0],
                      notas: "[Auto-Cash:Magia] Ajuste de compras pendientes GRRR, ZETA, ASTS",
                      user_id: user.id
                    }])
                    toast.success("¡Magia hecha! Efectivo ajustado en -5.007,20$. Recarga la página.")
                  } catch (e) { toast.error("Error al hacer magia") }
                }}
              >
                Ajustar Efectivo (-5.007,20$)
              </button>
            </div>

            {/* ── Portfolio Header ─────────────────────────── */}
            <div className="bg-background/95 border-b border-border/30">
              <PortfolioSummary
                totals={totals}
                positions={positions}
                transactions={allTransactions}
                loading={isLoading}
                pendingTxs={pendingTxs}
              />
            </div>

            {/* ── Main Content ──────────────────────────────────────── */}
            <div className="flex-1 p-6 space-y-6 max-w-[1600px] w-full mx-auto">

              {/* Row 1: Chart (wide) + Right panel */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">

                {/* Allocation / Performance chart */}
                <div className="min-w-0">
                  <AllocationChart positions={positions.filter(p => p.tipo !== 'Liquidez')} marketState={marketState} />
                </div>

                {/* Right column: Top Movers + Events */}
                <div className="flex flex-col gap-5">
                  <TopMovers positions={positions.filter(p => p.tipo !== 'Liquidez')} marketState={marketState} />
                  <UpcomingEvents
                    positions={positions.filter(p => p.tipo !== 'Liquidez')}
                    onAddEvent={() => { setEditEventData(null); setAddEventOpen(true) }}
                    onEditEvent={(data) => { setEditEventData(data); setAddEventOpen(true) }}
                  />
                </div>
              </div>

              {/* Row 1.5: Pending Orders */}
              <PendingOrders transactions={pendingTxs} />

              {/* Row 2: Positions Table */}
              <PositionsTable
                positions={positions.filter(p => p.tipo !== 'Liquidez')}
                loading={isLoading}
                onAddTransaction={openTransactionModal}
                onEditAsset={openEditAssetModal}
              />

            </div>

            {/* Price updated footer */}
            {pricesUpdatedAt && (
              <div className="text-[10px] text-muted-foreground/30 text-center py-3 border-t border-border/20">
                Precios actualizados: {new Date(pricesUpdatedAt).toLocaleString("es-ES")}
              </div>
            )}
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
        onSuccess={() => window.location.reload()}
      />
    </main>
  )
}
