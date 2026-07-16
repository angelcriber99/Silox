"use client"

import React, { useState, useMemo, Fragment } from "react"
import { useTransactions } from "@/lib/hooks/use-transactions"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { ArrowUpRight, ArrowDownRight, History, MoreHorizontal, Pencil, Search, Scale, Star } from "lucide-react"
import type { Transaccion } from '@/lib/types'
import { EditTransactionModal } from "@/components/transactions/edit-transaction-modal"
import { ExportExcelButton } from "@/components/transactions/export-excel-button"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import Link from "next/link"
import { usePreferences } from "@/lib/stores/use-preferences"
import { IOSHeader } from "@/components/ui/ios-header"
import { PageHeading } from "@/components/layout/page-heading"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function MovimientosPage() {
  const { data: transactions, isLoading } = useTransactions(1000)
  const { positions } = usePortfolio()
  const { hideBalances } = usePreferences()

  // State for modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaccion | null>(null)

  // State for filters
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | "Compra" | "Venta" | "Dividendo">("Todos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const handleEdit = (tx: Transaccion) => {
    setSelectedTx(tx)
    setEditModalOpen(true)
  }

  // Filter logic
  const filteredTransactions = useMemo(() => {
    if (!transactions) return []

    return transactions.filter((tx) => {
      // 0. Exclude Efectivo/CASH (since they clutter the view when buying assets)
      if (
        tx.notas?.includes("[Auto-Cash:") ||
        tx.notas?.includes("Auto-liquidez") ||
        tx.activo?.ticker?.startsWith('CASH') ||
        tx.activo?.nombre?.toLowerCase().includes('efectivo')
      ) {
        return false
      }
      // 1. Text Search (Asset name or ticker)
      const matchesSearch = searchQuery === "" ||
        tx.activo?.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.activo?.ticker?.toLowerCase().includes(searchQuery.toLowerCase())

      // 2. Type Filter
      const matchesType = typeFilter === "Todos" || tx.tipo_operacion === typeFilter

      // 3. Date Filter
      let matchesDate = true
      const txDate = new Date(tx.fecha)
      if (dateFrom) {
        matchesDate = matchesDate && txDate >= new Date(dateFrom)
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        matchesDate = matchesDate && txDate <= toDate
      }

      return matchesSearch && matchesType && matchesDate
    })
  }, [transactions, searchQuery, typeFilter, dateFrom, dateTo])

  // Group transactions by month for mobile grouped list
  const groupedByMonth = useMemo(() => {
    const groups: { label: string; items: typeof filteredTransactions }[] = []
    const map = new Map<string, typeof filteredTransactions>()
    for (const tx of filteredTransactions) {
      const d = new Date(tx.fecha)
      const key = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    }
    map.forEach((items, label) => groups.push({ label, items }))
    return groups
  }, [filteredTransactions])

  return (
    <main className="min-h-full bg-background text-foreground flex flex-col">
      {/* ── Mobile View ────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col pb-24 bg-background">
        <IOSHeader title="Movimientos" subtitle="Historial, búsqueda y edición de operaciones">
          <div className="flex flex-col gap-2.5">
            {/* Native Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar activo o ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-border/60 bg-card pl-9 text-[15px] font-medium text-foreground"
              />
            </div>

            {/* Type Filter Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x">
              {(["Todos", "Compra", "Venta", "Dividendo"] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setTypeFilter(opt)}
                  className={`h-9 flex-shrink-0 snap-start rounded-full px-4 text-[13px] font-bold transition-all ${typeFilter === opt ? "bg-primary text-primary-foreground" : "border border-border/60 bg-card text-muted-foreground"}`}
                >
                  {opt === "Todos" ? "Todos" : opt === "Compra" ? "Compras" : opt === "Venta" ? "Ventas" : "Dividendos"}
                </button>
              ))}
            </div>
          </div>
        </IOSHeader>

        {/* Transaction list grouped by month */}
        <div className="pb-2">
          {isLoading ? (
            <div className="px-4 pt-4 flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="h-4 w-28 bg-white/10 animate-pulse rounded mb-3 ml-1" />
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#111111" }}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="p-4 flex justify-between" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex gap-3 items-center">
                          <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                          <div>
                            <div className="h-3.5 w-24 bg-white/10 animate-pulse rounded mb-2" />
                            <div className="h-3 w-16 bg-white/10 animate-pulse rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-16 bg-white/10 animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : groupedByMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8">
              <div
                className="h-16 w-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.15)" }}
              >
                <History className="h-8 w-8" style={{ color: "#30D158", opacity: 0.6 }} />
              </div>
              <p className="text-[15px] font-semibold text-center" style={{ color: "rgba(255,255,255,0.70)" }}>Sin movimientos</p>
              <p className="text-[13px] text-center mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>Añade tu primera transacción pulsando el botón +</p>
            </div>
          ) : (
            <div className="px-4 pt-4 flex flex-col gap-6">
              {groupedByMonth.map(({ label, items }) => (
                <div key={label}>
                  {/* Month sticky header */}
                  <h2
                    className="text-[12px] font-bold uppercase tracking-widest mb-2 ml-1 capitalize"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {label}
                  </h2>

                  {/* Grouped card */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: "#111111", border: "0.5px solid rgba(255,255,255,0.08)" }}
                  >
                    {items.map((tx, idx) => {
                      const isCompra = tx.tipo_operacion === "Compra"
                      const isDividendo = tx.tipo_operacion === "Dividendo"
                      const total = isCompra
                        ? tx.cantidad * tx.precio_unitario + tx.comision
                        : tx.cantidad * tx.precio_unitario - tx.comision
                      const day = new Date(tx.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                      const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
                      const ticker = tx.activo
                        ? (isFondo ? tx.activo.nombre?.split(' ')[0].toUpperCase() : tx.activo.ticker.split('.')[0])
                        : "—"
                      const accentColor = isDividendo ? "#FFD60A" : isCompra ? "rgba(255,255,255,0.85)" : "#30D158"
                      const iconBg = isDividendo ? "rgba(255,214,10,0.12)" : isCompra ? "rgba(255,255,255,0.08)" : "rgba(48,209,88,0.12)"
                      const iconColor = isDividendo ? "#FFD60A" : isCompra ? "rgba(255,255,255,0.60)" : "#30D158"

                      return (
                        <div
                          key={tx.id}
                          onClick={() => handleEdit(tx)}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer active:opacity-70 transition-opacity"
                          style={{ borderBottom: idx < items.length - 1 ? "0.5px solid rgba(255,255,255,0.06)" : "none" }}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div
                              className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
                              style={{ background: iconBg }}
                            >
                              {isDividendo
                                ? <Star className="h-4 w-4" style={{ color: iconColor }} />
                                : isCompra
                                ? <ArrowUpRight className="h-4 w-4" style={{ color: iconColor }} />
                                : <ArrowDownRight className="h-4 w-4" style={{ color: iconColor }} />
                              }
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[15px] truncate" style={{ color: "#FFFFFF" }}>{ticker}</span>
                              <span className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.40)" }}>
                                {tx.tipo_operacion} · {day}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end min-w-0 ml-2">
                            <span className="text-[15px] font-bold tabular-nums" style={{ color: accentColor, letterSpacing: "-0.02em" }}>
                              {hideBalances ? "••••" : `${isCompra ? "−" : "+"}${formatCurrency(total, tx.activo?.moneda || "EUR")}`}
                            </span>
                            <span className="text-[11px] font-medium tabular-nums mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
                              {hideBalances ? "••••" : `${formatUnits(tx.cantidad)} × ${tx.precio_unitario.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop View ────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 max-w-7xl mx-auto w-full flex-col px-6 pb-10 space-y-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        
        {/* ── Page Header ────────────────────────────────────────── */}
        <PageHeading
          eyebrow="Actividad"
          title="Movimientos"
          description="Consulta, filtra y edita todas las operaciones que construyen tu cartera."
          icon={History}
          actions={<>
            <ExportExcelButton
              transactions={transactions || []}
              positions={positions || []}
            />
            <RevolutSync>
              <Button
                variant="outline"
                className="bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200 h-10 px-4 rounded-xl font-semibold text-sm"
                title="Sincronizar extracto (CSV/Excel)"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 shrink-0">
                  <path d="M14.6541 21.0118H9.33644V14.1611H5L12 3L19 14.1611H14.6541V21.0118Z" fill="currentColor"/>
                </svg>
                Importar
              </Button>
            </RevolutSync>
            <Link
              href="/declarar"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "rgba(48,209,88,0.10)",
                border: "1px solid rgba(48,209,88,0.25)",
                color: "#30D158",
              }}
            >
              <Scale className="h-4 w-4" />
              Declarar
            </Link>
          </>}
        />

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div
          className="flex flex-col gap-3 p-4 rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {/* Search */}
          <div className="relative w-full">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
            />
            <Input
              placeholder="Buscar por activo o ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full h-10"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar w-full snap-x">
            {(["Todos", "Compra", "Venta", "Dividendo"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setTypeFilter(opt)}
                className="flex-shrink-0 snap-start px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: typeFilter === opt ? "var(--primary)" : "var(--muted)",
                  border: "1px solid transparent",
                  color: typeFilter === opt ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >
                {opt === "Todos" ? "Todas" : opt === "Compra" ? "Compras" : opt === "Venta" ? "Ventas" : "Dividendos"}
              </button>
            ))}

            <div
              className="flex items-center gap-2 flex-shrink-0 snap-start rounded-full px-3 py-1.5"
              style={{ background: "var(--muted)", border: "1px solid transparent" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-sm outline-none w-auto [color-scheme:dark]"
                style={{ color: "var(--foreground)" }}
              />
            </div>

            <div
              className="flex items-center gap-2 flex-shrink-0 snap-start rounded-full px-3 py-1.5"
              style={{ background: "var(--muted)", border: "1px solid transparent" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-sm outline-none w-auto [color-scheme:dark]"
                style={{ color: "var(--foreground)" }}
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="border border-border bg-card/40 rounded-xl overflow-hidden backdrop-blur-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card/80 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Fecha</th>
                  <th className="px-6 py-4 font-medium">Operación</th>
                  <th className="px-6 py-4 font-medium">Activo</th>
                  <th className="px-6 py-4 font-medium text-right">Unidades</th>
                  <th className="px-6 py-4 font-medium text-right">Precio</th>
                  <th className="px-6 py-4 font-medium text-right">Comisión</th>
                  <th className="px-6 py-4 font-medium text-right">Total</th>
                  <th className="px-4 py-4 font-medium text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <History className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <p className="text-foreground/80 font-medium text-base">No se encontraron movimientos</p>
                        <p className="text-muted-foreground/80 text-sm">Ajusta los filtros para ver más resultados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedByMonth.map(({ label, items }) => (
                    <Fragment key={label}>
                      {/* Month Header Row */}
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td colSpan={8} className="px-6 py-2 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {label}
                        </td>
                      </tr>
                      {items.map((tx) => {
                        const isCompra = tx.tipo_operacion === "Compra"
                        const isDividendo = tx.tipo_operacion === "Dividendo"
                        let total = 0
                        if (isCompra) {
                          total = tx.cantidad * tx.precio_unitario + tx.comision
                        } else if (isDividendo) {
                          total = tx.precio_unitario - tx.comision - (tx.retencion_origen || 0) - (tx.retencion_destino || 0)
                        } else {
                          total = tx.cantidad * tx.precio_unitario - tx.comision
                        }
                        const date = new Date(tx.fecha).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })

                        const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
                        const ticker = tx.activo
                          ? (isFondo ? tx.activo.nombre?.split(' ')[0].toUpperCase() : tx.activo.ticker.split('.')[0])
                          : "—"

                        return (
                          <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-foreground/80">
                              {date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                                style={{
                                  background: isCompra ? "rgba(48,209,88,0.12)" : isDividendo ? "rgba(255,214,10,0.12)" : "rgba(255,69,58,0.12)",
                                  color: isCompra ? "#30D158" : isDividendo ? "#FFD60A" : "#FF453A",
                                }}
                              >
                                {isCompra ? <ArrowUpRight className="h-3 w-3" /> : isDividendo ? <Star className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {tx.tipo_operacion}
                              </span>
                              {tx.estado === "Pendiente" && (
                                <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground/90">{ticker}</span>
                                <span className="text-xs text-muted-foreground/80 truncate max-w-[200px]">{tx.activo?.nombre}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-foreground/80">
                              {hideBalances ? "****" : formatUnits(tx.cantidad)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-foreground/80">
                              {hideBalances ? "****" : tx.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-muted-foreground/80">
                              {hideBalances ? "****" : (tx.comision > 0 ? formatCurrency(tx.comision, tx.activo?.moneda || "EUR") : "0,00")}
                            </td>
                            <td
                              className="px-6 py-4 whitespace-nowrap text-right tabular-nums font-medium"
                              style={{ color: isCompra ? "#FFFFFF" : isDividendo ? "#FFD60A" : "#30D158" }}
                            >
                              {hideBalances ? "****" : `${isCompra ? "-" : "+"}${formatCurrency(total, tx.activo?.moneda || "EUR")}`}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-muted rounded-md focus:outline-none focus:opacity-100">
                                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground/90 min-w-[140px]">
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(tx)}
                                    className="hover:bg-muted focus:bg-muted cursor-pointer flex items-center gap-2"
                                  >
                                    <Pencil className="h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EditTransactionModal
        key={`${selectedTx?.id ?? 'none'}-${editModalOpen}`}
        transaction={selectedTx}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />
    </main>
  )
}
