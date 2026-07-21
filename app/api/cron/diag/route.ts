import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getSupabaseAdmin()
  const yahooFinance = getYahooFinance()

  const { data: activos } = await supabase.from('activos').select('*').eq('ticker', 'BABA')
  if (!activos || activos.length === 0) {
    return NextResponse.json({ error: "User does not have BABA in their DB." })
  }
  
  const activo = activos[0]
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 150)

  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  })
  
  const { data: txs } = await supabase.from('transacciones').select('*').eq('activo_id', activo.id).order('fecha', { ascending: true })
  
  const results = []
  
  for (const divEvent of historicalDivs || []) {
    const divDate = new Date(divEvent.date)
    const divDateStr = divDate.toISOString().split('T')[0]
    let shares = 0
    for (const tx of txs ?? []) {
      if (tx.fecha >= divDateStr) break
      if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
        shares += tx.cantidad
      }
      if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida' || tx.tipo_operacion === 'Retirada') {
        shares -= tx.cantidad
      }
    }
    results.push({
      divDateStr,
      divAmount: divEvent.dividends,
      sharesHeldBefore: shares,
    })
  }

  return NextResponse.json({
    activoId: activo.id,
    historicalDivs,
    txs,
    results
  })
}
