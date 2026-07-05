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
  year: number | 'Todos',
  theme: 'excel' | 'numbers' = 'excel'
) => {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = (await import('file-saver')).default

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Silox'
  workbook.lastModifiedBy = 'Silox'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Theme Colors
  const colors = {
    summaryHeader: theme === 'numbers' ? 'FF1D1D1F' : 'FF0F172A',
    fiscalHeader: theme === 'numbers' ? 'FFFF2D55' : 'FF4F46E5', // Apple Pink vs Indigo
    portfolioHeader: theme === 'numbers' ? 'FF007AFF' : 'FF1E293B', // Apple Blue vs Slate 800
    txHeader: theme === 'numbers' ? 'FFAF52DE' : 'FF334155', // Apple Purple vs Slate 700
    divHeader: theme === 'numbers' ? 'FF34C759' : 'FF059669', // Apple Green vs Emerald 600
    evolHeader: theme === 'numbers' ? 'FFFF9500' : 'FF0F172A', // Apple Orange vs Slate 900
    altRow: theme === 'numbers' ? 'FFF5F5F7' : 'FFF8FAFC', // Apple Gray vs Slate 50
    posText: theme === 'numbers' ? 'FF34C759' : 'FF10B981', // Apple Green vs Emerald 500
    negText: theme === 'numbers' ? 'FFFF3B30' : 'FFEF4444', // Apple Red vs Red 500
    headerHeight: theme === 'numbers' ? 32 : 24
  }

  const applyHeaderStyle = (ws: any, bgColor: string, columnCount: number) => {
    const row = ws.getRow(1)
    row.height = colors.headerHeight
    row.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: theme === 'numbers' ? 12 : 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } }
      }
    })
    // Freeze the top row
    ws.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }]
    // Add Auto-filters for the header row
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columnCount }
    }
  }

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    if (year === 'Todos') return true
    return new Date(tx.fecha).getFullYear() === year
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  // Calculate high-level stats
  const totalValor = positions.reduce((acc, p) => acc + (p.valor_actual || 0), 0)
  const totalInvertido = positions.reduce((acc, p) => acc + (p.coste_total_eur || 0), 0)
  const totalPnl = totalValor - totalInvertido
  const totalPnlPct = totalInvertido > 0 ? totalPnl / totalInvertido : 0
  const divs = filteredTxs.filter(tx => tx.tipo_operacion === 'Dividendo')
  const totalDivsNeto = divs.reduce((acc, tx) => acc + (Number(tx.precio_unitario) - Number(tx.comision || 0) - Number(tx.retencion_origen || 0) - Number(tx.retencion_destino || 0)), 0)

  // --- SHEET 0: RESUMEN EJECUTIVO ---
  const wsSummary = workbook.addWorksheet('Resumen')
  wsSummary.columns = [
    { header: '', key: 'spacer', width: 5 },
    { header: 'Métrica', key: 'metrica', width: 35 },
    { header: 'Valor', key: 'valor', width: 25 },
  ]
  wsSummary.views = [{ showGridLines: false }] // Clean look
  
  wsSummary.addRow([])
  const titleRow = wsSummary.addRow(['', '📊 REPORTE DE PORTFOLIO - SILOX'])
  titleRow.font = { size: 18, bold: true, color: { argb: colors.summaryHeader } }
  titleRow.height = 30
  
  const subtitleRow = wsSummary.addRow(['', `Año seleccionado: ${year}`])
  subtitleRow.font = { italic: true, color: { argb: 'FF64748B' } }
  subtitleRow.height = 20
  
  wsSummary.addRow([]).height = 15

  const addMetric = (label: string, value: any, format: string, color?: string) => {
    const row = wsSummary.addRow(['', label, value])
    row.height = 24
    row.getCell('metrica').font = { bold: true, size: 12 }
    row.getCell('metrica').alignment = { vertical: 'middle' }
    row.getCell('valor').numFmt = format
    row.getCell('valor').alignment = { horizontal: 'right', vertical: 'middle' }
    row.getCell('valor').font = { size: 12, bold: true, color: { argb: color || 'FF1E293B' } }
    row.getCell('metrica').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } }
    row.getCell('valor').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } }
    row.getCell('metrica').border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    row.getCell('valor').border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    return row
  }

  addMetric('Patrimonio Total', totalValor, '#,##0.00" €"')
  addMetric('Capital Invertido', totalInvertido, '#,##0.00" €"')
  addMetric('Ganancia Latente (P&L)', totalPnl, '#,##0.00" €"', totalPnl >= 0 ? colors.posText : colors.negText)
  addMetric('Rentabilidad Latente (%)', totalPnlPct, '0.00%', totalPnlPct >= 0 ? colors.posText : colors.negText)
  addMetric('Ingresos por Dividendos Netos', totalDivsNeto, '#,##0.00" €"', colors.posText)
  addMetric('Total Posiciones Abiertas', positions.filter(p => p.unidades > 0).length, '0')
  addMetric('Total Transacciones', filteredTxs.length, '0')
  
  wsSummary.addRow([]).height = 15
  const tipRow = wsSummary.addRow(['', '💡 Explora las pestañas inferiores para ver el desglose completo con tablas dinámicas y filtros integrados.'])
  tipRow.font = { italic: true, color: { argb: 'FF86868B' } }
  tipRow.height = 25

  // --- SHEET 1: POSICIONES ABIERTAS ---
  const wsPortfolio = workbook.addWorksheet('Posiciones Abiertas')
  wsPortfolio.columns = [
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 35 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Unidades', key: 'unidades', width: 18 },
    { header: 'Precio Compra', key: 'precio_medio', width: 20 },
    { header: 'Precio Actual', key: 'precio_actual', width: 20 },
    { header: 'Valor Total (€)', key: 'valor', width: 20 },
    { header: 'Invertido (€)', key: 'invertido', width: 20 },
    { header: 'P&L (€)', key: 'pnl_eur', width: 20 },
    { header: 'P&L (%)', key: 'pnl_pct', width: 15 },
  ]

  applyHeaderStyle(wsPortfolio, colors.portfolioHeader, 10)

  let portRow = 2
  positions.forEach((p) => {
    if (p.unidades <= 0) return
    const row = wsPortfolio.addRow({
      ticker: p.ticker, nombre: p.nombre || '', tipo: p.tipo,
      unidades: p.unidades, precio_medio: p.precio_medio, precio_actual: p.precio_actual,
      valor: p.valor_actual || 0, invertido: p.coste_total_eur,
      pnl_eur: p.pnl || 0, pnl_pct: (p.pnl_percent || 0) / 100
    })

    if (portRow % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } } })

    row.getCell('unidades').numFmt = '#,##0.00000000'
    row.getCell('precio_medio').numFmt = p.original_currency === 'EUR' ? '#,##0.00" €"' : '#,##0.00" $"'
    row.getCell('precio_actual').numFmt = p.original_currency === 'EUR' ? '#,##0.00" €"' : '#,##0.00" $"'
    row.getCell('valor').numFmt = '#,##0.00" €"'
    row.getCell('invertido').numFmt = '#,##0.00" €"'
    // Formulas instead of hardcoded values for Excel interactivity
    row.getCell('pnl_eur').value = { formula: `G${portRow}-H${portRow}`, result: p.pnl || 0 }
    row.getCell('pnl_eur').numFmt = '#,##0.00" €"'
    row.getCell('pnl_eur').font = { color: { argb: (p.pnl || 0) >= 0 ? colors.posText : colors.negText }, bold: true }
    
    // Protect against division by zero in formula
    row.getCell('pnl_pct').value = { formula: `IF(H${portRow}>0, I${portRow}/H${portRow}, 0)`, result: (p.pnl_percent || 0) / 100 }
    row.getCell('pnl_pct').numFmt = '0.00%'
    row.getCell('pnl_pct').font = { color: { argb: (p.pnl_percent || 0) >= 0 ? colors.posText : colors.negText }, bold: true }
    
    portRow++
  })

  wsPortfolio.addRow({})
  portRow++
  const totalPortRow = wsPortfolio.addRow({
    ticker: 'TOTALES'
  })
  totalPortRow.font = { bold: true, size: 12 }
  totalPortRow.getCell('valor').value = { formula: `SUBTOTAL(9, G2:G${portRow-2})` }
  totalPortRow.getCell('invertido').value = { formula: `SUBTOTAL(9, H2:H${portRow-2})` }
  totalPortRow.getCell('pnl_eur').value = { formula: `SUBTOTAL(9, I2:I${portRow-2})` }
  totalPortRow.getCell('pnl_pct').value = { formula: `IF(H${portRow}>0, I${portRow}/H${portRow}, 0)` }

  totalPortRow.getCell('valor').numFmt = '#,##0.00" €"'
  totalPortRow.getCell('invertido').numFmt = '#,##0.00" €"'
  totalPortRow.getCell('pnl_eur').numFmt = '#,##0.00" €"'
  totalPortRow.getCell('pnl_pct').numFmt = '0.00%'


  // --- SHEET 2: TRANSACCIONES ---
  const wsTx = workbook.addWorksheet('Historial Completo')
  wsTx.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Operación', key: 'tipo', width: 15 },
    { header: 'Moneda', key: 'moneda', width: 10 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Activo', key: 'nombre', width: 35 },
    { header: 'Cantidad', key: 'cantidad', width: 18 },
    { header: 'Precio Unitario', key: 'precio', width: 20 },
    { header: 'Comisiones', key: 'comision', width: 15 },
    { header: 'Total Efectivo', key: 'total', width: 20 },
    { header: 'Estado', key: 'estado', width: 15 },
  ]

  applyHeaderStyle(wsTx, colors.txHeader, 10)

  const txsExcludingDivs = filteredTxs.filter(tx => tx.tipo_operacion !== 'Dividendo')
  
  let txRowIdx = 2
  txsExcludingDivs.forEach((tx) => {
    const isCompra = tx.tipo_operacion === 'Compra'
    
    const moneda = tx.activo?.moneda || 'EUR'
    const currencyFmt = moneda === 'EUR' ? '#,##0.00" €"' : '#,##0.00" $"'

    const sign = isCompra ? -1 : 1
    const total = sign * ((tx.cantidad * tx.precio_unitario) + (isCompra ? tx.comision : -tx.comision))
    const formulaStr = isCompra 
      ? `-((F${txRowIdx} * G${txRowIdx}) + H${txRowIdx})` 
      : `(F${txRowIdx} * G${txRowIdx}) - H${txRowIdx}`

    const row = wsTx.addRow({
      fecha: new Date(tx.fecha), 
      tipo: tx.tipo_operacion, 
      moneda: moneda,
      ticker: tx.activo?.ticker,
      nombre: tx.activo?.nombre || '', 
      cantidad: tx.cantidad, 
      precio: tx.precio_unitario,
      comision: tx.comision,
      estado: tx.estado || 'Completada'
    })
    
    // Formula for Total Efectivo
    row.getCell('total').value = { formula: formulaStr, result: total }

    if (txRowIdx % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } } })

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    row.getCell('cantidad').numFmt = '#,##0.00000000'
    row.getCell('precio').numFmt = currencyFmt
    row.getCell('comision').numFmt = currencyFmt
    row.getCell('total').numFmt = currencyFmt
    
    row.getCell('tipo').font = { color: { argb: isCompra ? (theme === 'numbers' ? 'FF007AFF' : 'FF3B82F6') : (theme === 'numbers' ? 'FFAF52DE' : 'FF8B5CF6') }, bold: true }
    row.getCell('total').font = { color: { argb: total >= 0 ? colors.posText : colors.negText }, bold: true }
    
    txRowIdx++
  })


  // --- SHEET 3: RESUMEN FISCAL (FIFO) ---
  const wsFiscal = workbook.addWorksheet('Resumen Fiscal')
  wsFiscal.columns = [
    { header: 'Fecha Venta', key: 'fecha', width: 15 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 35 },
    { header: 'Cantidad', key: 'cantidad', width: 18 },
    { header: 'Ingreso Venta', key: 'ingreso', width: 20 },
    { header: 'Coste Adquisición', key: 'coste', width: 20 },
    { header: 'Resultado P/G', key: 'ganancia', width: 20 },
    { header: 'Retención Origen', key: 'ret_origen', width: 20 },
    { header: 'Retención Destino', key: 'ret_destino', width: 20 },
    { header: 'Detalles FIFO', key: 'detalles', width: 60 },
  ]

  applyHeaderStyle(wsFiscal, colors.fiscalHeader, 10)

  const taxEvents = calculateFIFO(transactions)
  const filteredEvents = taxEvents.filter(e => {
    if (year === 'Todos') return true
    return e.añoFiscal === year
  })

  let fisRow = 2
  let sumIngreso = 0
  let sumCoste = 0
  let sumGanancia = 0
  let sumRetOrigen = 0
  let sumRetDestino = 0

  filteredEvents.forEach((ev) => {
    sumIngreso += ev.ingresoVenta || 0
    sumCoste += ev.costeAdquisicion || 0
    sumGanancia += ev.gananciaPatrimonial || 0
    sumRetOrigen += ev.retencionOrigen || 0
    sumRetDestino += ev.retencionDestino || 0

    const row = wsFiscal.addRow({
      fecha: new Date(ev.fechaVenta),
      ticker: ev.ticker,
      nombre: ev.nombre,
      cantidad: ev.cantidadVendida,
      ingreso: ev.ingresoVenta,
      coste: ev.costeAdquisicion,
      ret_origen: ev.retencionOrigen,
      ret_destino: ev.retencionDestino,
      detalles: ev.detalles
    })
    
    // Formula for Resultado P/G
    row.getCell('ganancia').value = { formula: `E${fisRow}-F${fisRow}`, result: ev.gananciaPatrimonial }

    if (fisRow % 2 !== 0) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } } })
    }

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    row.getCell('cantidad').numFmt = '#,##0.00000000'
    ;['ingreso', 'coste', 'ganancia', 'ret_origen', 'ret_destino'].forEach(key => {
      row.getCell(key).numFmt = '#,##0.00" €"'
    })

    row.getCell('ganancia').font = { 
      color: { argb: ev.gananciaPatrimonial >= 0 ? colors.posText : colors.negText }, 
      bold: true 
    }
    fisRow++
  })

  wsFiscal.addRow({})
  fisRow++
  const sumFisRow = wsFiscal.addRow({ nombre: 'TOTALES PÉRDIDAS Y GANANCIAS:' })
  sumFisRow.font = { bold: true, size: 12 }
  sumFisRow.getCell('ingreso').value = { formula: `SUBTOTAL(9, E2:E${fisRow-2})`, result: sumIngreso }
  sumFisRow.getCell('coste').value = { formula: `SUBTOTAL(9, F2:F${fisRow-2})`, result: sumCoste }
  sumFisRow.getCell('ganancia').value = { formula: `SUBTOTAL(9, G2:G${fisRow-2})`, result: sumGanancia }
  sumFisRow.getCell('ret_origen').value = { formula: `SUBTOTAL(9, H2:H${fisRow-2})`, result: sumRetOrigen }
  sumFisRow.getCell('ret_destino').value = { formula: `SUBTOTAL(9, I2:I${fisRow-2})`, result: sumRetDestino }
  
  ;['ingreso', 'coste', 'ganancia', 'ret_origen', 'ret_destino'].forEach(key => {
    sumFisRow.getCell(key).numFmt = '#,##0.00" €"'
  })


  // --- SHEET 4: DIVIDENDOS ---
  const wsDivs = workbook.addWorksheet('Dividendos')
  wsDivs.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Símbolo', key: 'ticker', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 35 },
    { header: 'Importe Bruto', key: 'bruto', width: 20 },
    { header: 'Comisiones', key: 'comision', width: 15 },
    { header: 'Retención Origen', key: 'ret_origen', width: 20 },
    { header: 'Retención Destino', key: 'ret_destino', width: 20 },
    { header: 'Importe Neto', key: 'neto', width: 20 },
  ]

  applyHeaderStyle(wsDivs, colors.divHeader, 8)

  let divRowIdx = 2
  let sumBruto = 0
  let sumComision = 0
  let sumDivRetOrigen = 0
  let sumDivRetDestino = 0
  let sumNeto = 0

  divs.forEach((tx) => {
    const isLegacy = Number(tx.cantidad) === 0.000001
    const bruto = isLegacy ? Number(tx.precio_unitario) : Number(tx.precio_unitario)
    const com = Number(tx.comision || 0)
    const ro = Number(tx.retencion_origen || 0)
    const rd = Number(tx.retencion_destino || 0)
    const neto = bruto - com - ro - rd

    sumBruto += bruto
    sumComision += com
    sumDivRetOrigen += ro
    sumDivRetDestino += rd
    sumNeto += neto

    // Add row data
    const row = wsDivs.addRow({
      fecha: new Date(tx.fecha),
      ticker: tx.activo?.ticker || '',
      nombre: tx.activo?.nombre || '',
      bruto: bruto,
      comision: com,
      ret_origen: ro,
      ret_destino: rd,
      neto: neto
    })
    
    // Formula for Neto
    row.getCell('neto').value = { formula: `D${divRowIdx}-E${divRowIdx}-F${divRowIdx}-G${divRowIdx}`, result: bruto - com - ro - rd }

    if (divRowIdx % 2 !== 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } } })

    row.getCell('fecha').numFmt = 'dd/mm/yyyy'
    ;['bruto', 'comision', 'ret_origen', 'ret_destino', 'neto'].forEach(key => {
      row.getCell(key).numFmt = '#,##0.00" €"'
    })
    row.getCell('neto').font = { color: { argb: colors.posText }, bold: true }
    divRowIdx++
  })

  wsDivs.addRow({})
  divRowIdx++
  const sumDivRow = wsDivs.addRow({ nombre: 'TOTALES DIVIDENDOS:' })
  sumDivRow.font = { bold: true, size: 12 }
  const divSums = [sumBruto, sumComision, sumDivRetOrigen, sumDivRetDestino, sumNeto]
  ;['bruto', 'comision', 'ret_origen', 'ret_destino', 'neto'].forEach((key, colIdx) => {
    const colLetters = ['D', 'E', 'F', 'G', 'H']
    const letter = colLetters[colIdx]
    sumDivRow.getCell(key).value = { 
      formula: `SUBTOTAL(9, ${letter}2:${letter}${divRowIdx-2})`,
      result: divSums[colIdx]
    }
    sumDivRow.getCell(key).numFmt = '#,##0.00" €"'
  })

  
  // --- SHEET 5: EVOLUCIÓN MENSUAL ---
  const wsEvol = workbook.addWorksheet('Evolución Mensual')
  wsEvol.columns = [
    { header: 'Mes', key: 'mes', width: 20 },
    { header: 'Total Comprado', key: 'comprado', width: 20 },
    { header: 'Total Vendido', key: 'vendido', width: 20 },
    { header: 'Dividendos', key: 'dividendos', width: 20 },
    { header: 'Comisiones', key: 'comisiones', width: 20 },
    { header: 'Flujo Neto (Aportación)', key: 'flujo', width: 25 },
  ]

  applyHeaderStyle(wsEvol, colors.evolHeader, 6)

  const monthlyData: Record<string, any> = {}
  
  filteredTxs.forEach(tx => {
    const d = new Date(tx.fecha)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { mes: monthKey, comprado: 0, vendido: 0, dividendos: 0, comisiones: 0, flujo: 0 }
    }
    
    const isLegacy = Number(tx.cantidad) === 0.000001
    const total = isLegacy ? Number(tx.precio_unitario) : (tx.cantidad * tx.precio_unitario)
    
    if (tx.tipo_operacion === 'Compra') {
      monthlyData[monthKey].comprado += total
      monthlyData[monthKey].flujo -= total
    } else if (tx.tipo_operacion === 'Venta') {
      monthlyData[monthKey].vendido += total
      monthlyData[monthKey].flujo += total
    } else if (tx.tipo_operacion === 'Dividendo') {
      monthlyData[monthKey].dividendos += total
      monthlyData[monthKey].flujo += total
    }
    monthlyData[monthKey].comisiones += tx.comision
    monthlyData[monthKey].flujo -= tx.comision
  })

  const sortedMonths = Object.values(monthlyData).sort((a: any, b: any) => a.mes.localeCompare(b.mes))
  
  let evolRowIdx = 2
  sortedMonths.forEach((data: any) => {
    const row = wsEvol.addRow(data)
    
    // Formula for Flujo Neto: Vendido + Dividendos - Comprado - Comisiones
    row.getCell('flujo').value = { formula: `C${evolRowIdx}+D${evolRowIdx}-B${evolRowIdx}-E${evolRowIdx}`, result: data.flujo }

    if (evolRowIdx % 2 !== 0) row.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.altRow } } })
    
    ;['comprado', 'vendido', 'dividendos', 'comisiones', 'flujo'].forEach(key => {
      row.getCell(key).numFmt = '#,##0.00" €"'
    })
    
    row.getCell('flujo').font = { color: { argb: data.flujo >= 0 ? colors.posText : colors.negText }, bold: true }
    evolRowIdx++
  })

  // Chart instructions
  wsEvol.addRow({})
  wsEvol.addRow({ mes: '💡 TIP:' })
  wsEvol.addRow({ mes: 'Puedes filtrar y ordenar en las cabeceras de cada columna.' })
  wsEvol.getCell('A'+(wsEvol.rowCount)).font = { italic: true, color: { argb: 'FF86868B' } }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const filename = theme === 'numbers' ? `Silox_Numbers_${year}.xlsx` : `Silox_Excel_${year}.xlsx`
  saveAs(blob, filename)
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

  const handleExport = async (year: number | 'Todos', theme: 'excel' | 'numbers') => {
    setIsExporting(true)
    try {
      await exportToExcel(transactions, positions, year, theme)
      toast.success(`${theme === 'numbers' ? 'Apple Numbers' : 'Excel'} generado correctamente (${year})`)
    } catch (error) {
      console.error(error)
      toast.error(`Error al generar archivo para ${theme === 'numbers' ? 'Numbers' : 'Excel'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-border" disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
          Exportar Reporte
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">Exportar a Excel</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport('Todos', 'excel')} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 text-emerald-500" />
          Excel - Todos los años
        </DropdownMenuItem>
        {years.map(y => (
          <DropdownMenuItem key={`excel-${y}`} onClick={() => handleExport(y, 'excel')} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4 text-emerald-500" />
            Excel - Año {y}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground flex items-center gap-1">
          🍏 Exportar a Apple Numbers
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport('Todos', 'numbers')} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 text-blue-500" />
          Numbers - Todos los años
        </DropdownMenuItem>
        {years.map(y => (
          <DropdownMenuItem key={`numbers-${y}`} onClick={() => handleExport(y, 'numbers')} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4 text-blue-500" />
            Numbers - Año {y}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
