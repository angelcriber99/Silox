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
import { calculateFIFO } from "@/lib/utils/fifo-calculator"

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

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    if (year === 'Todos') return true
    return new Date(tx.fecha).getFullYear() === year
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  // --- SHEET 1: RESUMEN FISCAL (FIFO) ---
  const wsFiscal = workbook.addWorksheet('Resumen Fiscal')
  wsFiscal.columns = [
    { header: 'Fecha Venta', key: 'fecha', width: 15 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 15 },
    { header: 'Ingreso Venta', key: 'ingreso', width: 20 },
    { header: 'Coste Adquisición', key: 'coste', width: 20 },
    { header: 'Resultado P/G', key: 'ganancia', width: 20 },
    { header: 'Retención Origen', key: 'ret_origen', width: 20 },
    { header: 'Retención Destino', key: 'ret_destino', width: 20 },
    { header: 'Detalles FIFO', key: 'detalles', width: 50 },
  ]

  wsFiscal.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } } // Indigo 600
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  // Calculate FIFO for the selected year
  const taxEvents = calculateFIFO(transactions)
  const filteredEvents = taxEvents.filter(e => {
    if (year === 'Todos') return true
    return e.añoFiscal === year
  })

  let totalGains = 0
  let totalLosses = 0

  filteredEvents.forEach((ev, idx) => {
    if (ev.gananciaPatrimonial > 0) totalGains += ev.gananciaPatrimonial
    else totalLosses += Math.abs(ev.gananciaPatrimonial)

    const row = wsFiscal.addRow({
      fecha: new Date(ev.fechaVenta),
      ticker: ev.ticker,
      nombre: ev.nombre,
      cantidad: ev.cantidadVendida,
      ingreso: ev.ingresoVenta,
      coste: ev.costeAdquisicion,
      ganancia: ev.gananciaPatrimonial,
      ret_origen: ev.retencionOrigen,
      ret_destino: ev.retencionDestino,
      detalles: ev.detalles
    })

    if (idx % 2 !== 0) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
    }

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    row.getCell('cantidad').numFmt = '#,##0.00000000'
    ;['ingreso', 'coste', 'ganancia', 'ret_origen', 'ret_destino'].forEach(key => {
      row.getCell(key).numFmt = '€#,##0.00'
    })

    row.getCell('ganancia').font = { 
      color: { argb: ev.gananciaPatrimonial >= 0 ? 'FF10B981' : 'FFEF4444' }, 
      bold: true 
    }
  })

  wsFiscal.addRow({})
  const totalGainsRow = wsFiscal.addRow({ nombre: 'TOTAL GANANCIAS:', ganancia: totalGains })
  const totalLossesRow = wsFiscal.addRow({ nombre: 'TOTAL PÉRDIDAS:', ganancia: -totalLosses })
  const netRow = wsFiscal.addRow({ nombre: 'RENDIMIENTO NETO:', ganancia: totalGains - totalLosses })

  ;[totalGainsRow, totalLossesRow, netRow].forEach(r => {
    r.font = { bold: true }
    r.getCell('ganancia').numFmt = '€#,##0.00'
  })
  netRow.getCell('ganancia').font = { color: { argb: (totalGains - totalLosses) >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }

  // --- SHEET 2: POSICIONES ABIERTAS ---
  const wsPortfolio = workbook.addWorksheet('Posiciones Abiertas')
  wsPortfolio.columns = [
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Unidades', key: 'unidades', width: 15 },
    { header: 'Precio Compra', key: 'precio_medio', width: 20 },
    { header: 'Precio Actual', key: 'precio_actual', width: 20 },
    { header: 'Valor Total (€)', key: 'valor', width: 20 },
    { header: 'Invertido (€)', key: 'invertido', width: 20 },
    { header: 'P&L (€)', key: 'pnl_eur', width: 20 },
    { header: 'P&L (%)', key: 'pnl_pct', width: 15 },
  ]

  wsPortfolio.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  let totalValor = 0, totalInvertido = 0, totalPnl = 0
  positions.forEach((p, idx) => {
    if (p.unidades <= 0) return
    const row = wsPortfolio.addRow({
      ticker: p.ticker, nombre: p.nombre || '', tipo: p.tipo,
      unidades: p.unidades, precio_medio: p.precio_medio, precio_actual: p.precio_actual,
      valor: p.valor_actual || 0, invertido: p.coste_total_eur,
      pnl_eur: p.pnl || 0, pnl_pct: (p.pnl_percent || 0) / 100
    })

    if (idx % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })

    row.getCell('unidades').numFmt = '#,##0.00000000'
    row.getCell('precio_medio').numFmt = p.original_currency === 'EUR' ? '€#,##0.00' : '$#,##0.00'
    row.getCell('precio_actual').numFmt = p.original_currency === 'EUR' ? '€#,##0.00' : '$#,##0.00'
    row.getCell('valor').numFmt = '€#,##0.00'
    row.getCell('invertido').numFmt = '€#,##0.00'
    row.getCell('pnl_eur').numFmt = '€#,##0.00'
    row.getCell('pnl_eur').font = { color: { argb: (p.pnl || 0) >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }
    row.getCell('pnl_pct').numFmt = '0.00%'
    row.getCell('pnl_pct').font = { color: { argb: (p.pnl_percent || 0) >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }

    totalValor += p.valor_actual || 0; totalInvertido += p.coste_total_eur; totalPnl += p.pnl || 0
  })

  wsPortfolio.addRow({})
  const totalRow = wsPortfolio.addRow({
    ticker: 'TOTAL', valor: totalValor, invertido: totalInvertido,
    pnl_eur: totalPnl, pnl_pct: totalInvertido > 0 ? (totalPnl / totalInvertido) : 0
  })
  totalRow.font = { bold: true }
  totalRow.getCell('valor').numFmt = '€#,##0.00'
  totalRow.getCell('invertido').numFmt = '€#,##0.00'
  totalRow.getCell('pnl_eur').numFmt = '€#,##0.00'
  totalRow.getCell('pnl_pct').numFmt = '0.00%'
  totalRow.getCell('pnl_eur').font = { color: { argb: totalPnl >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }
  totalRow.getCell('pnl_pct').font = { color: { argb: totalPnl >= 0 ? 'FF10B981' : 'FFEF4444' }, bold: true }

  // --- SHEET 3: TRANSACCIONES ---
  const wsTx = workbook.addWorksheet('Historial Completo')
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  const txsExcludingDivs = filteredTxs.filter(tx => tx.tipo_operacion !== 'Dividendo')
  
  let sumCompras = 0, sumVentas = 0, sumComisiones = 0
  txsExcludingDivs.forEach((tx, idx) => {
    const isCompra = tx.tipo_operacion === 'Compra'
    const total = (tx.cantidad * tx.precio_unitario) + tx.comision

    if (isCompra) sumCompras += total; else sumVentas += total
    sumComisiones += tx.comision

    const row = wsTx.addRow({
      fecha: new Date(tx.fecha), tipo: tx.tipo_operacion, ticker: tx.activo?.ticker,
      nombre: tx.activo?.nombre || '', cantidad: tx.cantidad, precio: tx.precio_unitario,
      comision: tx.comision, total: total
    })

    if (idx % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    row.getCell('cantidad').numFmt = '#,##0.00000000'
    row.getCell('precio').numFmt = '#,##0.00'
    row.getCell('comision').numFmt = '#,##0.00'
    row.getCell('total').numFmt = '#,##0.00'
    row.getCell('tipo').font = { color: { argb: isCompra ? 'FF3B82F6' : 'FF8B5CF6' }, bold: true }
  })

  wsTx.addRow({})
  ;[wsTx.addRow({ nombre: 'TOTAL COMPRADO:', total: sumCompras }),
    wsTx.addRow({ nombre: 'TOTAL VENDIDO:', total: sumVentas }),
    wsTx.addRow({ nombre: 'TOTAL COMISIONES:', comision: sumComisiones })].forEach(r => {
      r.font = { bold: true }
      r.getCell('total').numFmt = '€#,##0.00'
      r.getCell('comision').numFmt = '€#,##0.00'
  })

  // --- SHEET 4: DIVIDENDOS ---
  const wsDivs = workbook.addWorksheet('Dividendos')
  wsDivs.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Importe Bruto', key: 'bruto', width: 20 },
    { header: 'Comisiones', key: 'comision', width: 15 },
    { header: 'Retención Origen', key: 'ret_origen', width: 20 },
    { header: 'Retención Destino', key: 'ret_destino', width: 20 },
    { header: 'Importe Neto', key: 'neto', width: 20 },
  ]

  wsDivs.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } } // Emerald 600
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  const divs = filteredTxs.filter(tx => tx.tipo_operacion === 'Dividendo')
  
  let dBruto = 0, dComision = 0, dRot = 0, dRdt = 0, dNeto = 0
  divs.forEach((tx, idx) => {
    const isLegacy = Number(tx.cantidad) === 0.000001
    const bruto = isLegacy ? Number(tx.precio_unitario) : Number(tx.precio_unitario)
    const com = Number(tx.comision || 0)
    const ro = Number(tx.retencion_origen || 0)
    const rd = Number(tx.retencion_destino || 0)
    const neto = bruto - com - ro - rd

    dBruto += bruto; dComision += com; dRot += ro; dRdt += rd; dNeto += neto

    const row = wsDivs.addRow({
      fecha: new Date(tx.fecha), ticker: tx.activo?.ticker, nombre: tx.activo?.nombre || '',
      bruto, comision: com, ret_origen: ro, ret_destino: rd, neto
    })

    if (idx % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    ;['bruto', 'comision', 'ret_origen', 'ret_destino', 'neto'].forEach(key => {
      row.getCell(key).numFmt = '€#,##0.00'
    })
    row.getCell('neto').font = { color: { argb: 'FF10B981' }, bold: true }
  })

  wsDivs.addRow({})
  const divTotalsRow = wsDivs.addRow({
    nombre: 'TOTALES:', bruto: dBruto, comision: dComision, ret_origen: dRot, ret_destino: dRdt, neto: dNeto
  })
  divTotalsRow.font = { bold: true }
  ;['bruto', 'comision', 'ret_origen', 'ret_destino', 'neto'].forEach(key => {
    divTotalsRow.getCell(key).numFmt = '€#,##0.00'
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
            Año {y}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
