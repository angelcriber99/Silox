"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, FileSpreadsheet } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import type { Transaccion, EnrichedPosition } from "@/lib/types"

// Lazy import to avoid loading exceljs unnecessarily on first render
const exportToExcel = async (
  transactions: Transaccion[], 
  positions: EnrichedPosition[], 
  year: number | 'Todos'
) => {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = (await import('file-saver')).default

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Silox'
  workbook.created = new Date()

  // --- SHEET 1: ESTADO DE LA CARTERA ---
  const wsPortfolio = workbook.addWorksheet('Resumen de Cartera')
  
  // Columns
  wsPortfolio.columns = [
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Unidades', key: 'unidades', width: 15 },
    { header: 'Precio Compra', key: 'precio_medio', width: 20 },
    { header: 'Precio Actual', key: 'precio_actual', width: 20 },
    { header: 'Valor Total', key: 'valor', width: 20 },
    { header: 'Invertido', key: 'invertido', width: 20 },
    { header: 'P&L (€)', key: 'pnl_eur', width: 20 },
    { header: 'P&L (%)', key: 'pnl_pct', width: 15 },
  ]

  // Header styles
  wsPortfolio.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  // Add Data
  let totalValor = 0
  let totalInvertido = 0
  let totalPnl = 0

  positions.forEach(p => {
    if (p.unidades <= 0) return

    const isCrypto = p.tipo === 'Crypto'
    const currencyFormatter = p.original_currency === 'EUR' ? '€#,##0.00' : '$#,##0.00'

    const row = wsPortfolio.addRow({
      ticker: p.ticker,
      nombre: p.nombre || '',
      tipo: p.tipo,
      unidades: p.unidades,
      precio_medio: p.precio_medio,
      precio_actual: p.precio_actual,
      valor: p.valor_actual || 0,
      invertido: p.coste_total_eur,
      pnl_eur: p.pnl || 0,
      pnl_pct: (p.pnl_percent || 0) / 100 // Excel formats % by multiplying by 100
    })

    // Formatting numbers
    row.getCell('unidades').numFmt = isCrypto ? '#,##0.00000000' : '#,##0.00'
    row.getCell('precio_medio').numFmt = currencyFormatter
    row.getCell('precio_actual').numFmt = currencyFormatter
    row.getCell('valor').numFmt = '€#,##0.00'
    row.getCell('invertido').numFmt = '€#,##0.00'
    
    // PNL Formatting
    const pnlCell = row.getCell('pnl_eur')
    pnlCell.numFmt = '€#,##0.00'
    pnlCell.font = { color: { argb: (p.pnl || 0) >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true } // Emerald or Red

    const pctCell = row.getCell('pnl_pct')
    pctCell.numFmt = '0.00%'
    pctCell.font = { color: { argb: (p.pnl_percent || 0) >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }

    totalValor += p.valor_actual || 0
    totalInvertido += p.coste_total_eur
    totalPnl += p.pnl || 0
  })

  // Add Totals Row
  const totalRow = wsPortfolio.addRow({
    ticker: 'TOTAL',
    valor: totalValor,
    invertido: totalInvertido,
    pnl_eur: totalPnl,
    pnl_pct: totalInvertido > 0 ? (totalPnl / totalInvertido) : 0
  })
  totalRow.font = { bold: true }
  totalRow.getCell('valor').numFmt = '€#,##0.00'
  totalRow.getCell('invertido').numFmt = '€#,##0.00'
  totalRow.getCell('pnl_eur').numFmt = '€#,##0.00'
  totalRow.getCell('pnl_pct').numFmt = '0.00%'
  totalRow.getCell('pnl_eur').font = { color: { argb: totalPnl >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }
  totalRow.getCell('pnl_pct').font = { color: { argb: totalPnl >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }

  // --- SHEET 2: MOVIMIENTOS ---
  const wsTx = workbook.addWorksheet(`Movimientos ${year}`)

  wsTx.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Operación', key: 'tipo', width: 15 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Activo', key: 'nombre', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 15 },
    { header: 'Precio Unitario', key: 'precio', width: 20 },
    { header: 'Comisiones', key: 'comision', width: 15 },
    { header: 'Total Efectivo', key: 'total', width: 20 },
  ]

  wsTx.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    if (year === 'Todos') return true
    return new Date(tx.fecha).getFullYear() === year
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  let sumCompras = 0
  let sumVentas = 0
  let sumComisiones = 0

  filteredTxs.forEach((tx, idx) => {
    const isCompra = tx.tipo_operacion === 'Compra'
    const total = (tx.cantidad * tx.precio_unitario) + tx.comision

    if (isCompra) {
      sumCompras += total
    } else {
      sumVentas += total
    }
    sumComisiones += tx.comision

    const row = wsTx.addRow({
      fecha: new Date(tx.fecha),
      tipo: tx.tipo_operacion,
      ticker: tx.activo?.ticker,
      nombre: tx.activo?.nombre || '',
      cantidad: tx.cantidad,
      precio: tx.precio_unitario,
      comision: tx.comision,
      total: total
    })

    // Stripe rows
    if (idx % 2 !== 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } // Slate 50
      })
    }

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    row.getCell('cantidad').numFmt = '#,##0.00000000'
    row.getCell('precio').numFmt = '#,##0.00' // Leaving generic, can be USD or EUR
    row.getCell('comision').numFmt = '#,##0.00'
    row.getCell('total').numFmt = '#,##0.00'
    
    row.getCell('tipo').font = { color: { argb: isCompra ? 'FF3B82F6' : 'FF8B5CF6' }, bold: true } // Blue vs Purple
  })

  // Totals Row
  wsTx.addRow({}) // Empty row
  const sumRow1 = wsTx.addRow({ nombre: 'TOTAL COMPRADO:', total: sumCompras })
  const sumRow2 = wsTx.addRow({ nombre: 'TOTAL VENDIDO:', total: sumVentas })
  const sumRow3 = wsTx.addRow({ nombre: 'TOTAL COMISIONES:', comision: sumComisiones })
  
  ;[sumRow1, sumRow2, sumRow3].forEach(r => {
    r.font = { bold: true }
    r.getCell('total').numFmt = '€#,##0.00'
    r.getCell('comision').numFmt = '€#,##0.00'
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `Silox_Reporte_${year}.xlsx`)
}

interface Props {
  transactions: Transaccion[]
  positions: EnrichedPosition[]
}

export function ExportExcelButton({ transactions, positions }: Props) {
  const [isExporting, setIsExporting] = useState(false)

  // Get unique years from transactions
  const years = useMemo(() => {
    if (!transactions.length) return []
    const y = new Set(transactions.map(t => new Date(t.fecha).getFullYear()))
    return Array.from(y).sort((a, b) => b - a)
  }, [transactions])

  const handleExport = async (year: number | 'Todos') => {
    setIsExporting(true)
    try {
      await exportToExcel(transactions, positions, year)
      toast.success(`Excel generado correctamente (${year})`)
    } catch (error) {
      console.error(error)
      toast.error('Error al generar el Excel')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-border" disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
          Exportar a Excel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Selecciona un año</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('Todos')} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 text-muted-foreground" />
          Todos los años
        </DropdownMenuItem>
        {years.length > 0 && <DropdownMenuSeparator />}
        {years.map(y => (
          <DropdownMenuItem key={y} onClick={() => handleExport(y)} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            {y}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
