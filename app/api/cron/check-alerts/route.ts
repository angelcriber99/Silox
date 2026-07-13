import { NextResponse } from 'next/server'
import { normalizeYahooCurrency } from '@/lib/utils/currency'
import { authorizeCronRequest } from '@/lib/server/cron-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authorization = authorizeCronRequest(request)
    if (!authorization.authorized) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      )
    }

    const yahooFinance = getYahooFinance()

    const supabase = getSupabaseAdmin()

    // Obtener las alertas activas (no disparadas)
    const { data: alertas, error: alertsError } = await supabase
      .from('alertas')
      .select('*')
      .eq('triggered', false)

    if (alertsError) throw alertsError
    if (!alertas || alertas.length === 0) {
      return NextResponse.json({ message: 'No active alerts to check' })
    }

    // 3. Extraer todos los tickers únicos necesarios
    const uniqueTickers = Array.from(new Set(alertas.map(a => a.ticker)))

    // 4. Obtener precios de Yahoo Finance (en paralelo)
    const pricesMap: Record<string, { price: number; high: number; low: number; currency: string }> = {}
    const quoteResults = await mapSettledWithConcurrency(
      uniqueTickers,
      8,
      async (ticker) => ({ ticker, quote: await yahooFinance.quote(ticker) }),
    )

    quoteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to fetch price for ${uniqueTickers[index]}`, result.reason)
        return
      }
      const { ticker, quote } = result.value
      if (quote.regularMarketPrice == null) return
      pricesMap[ticker.toUpperCase()] = {
        price: quote.regularMarketPrice,
        high: quote.regularMarketDayHigh ?? quote.regularMarketPrice,
        low: quote.regularMarketDayLow ?? quote.regularMarketPrice,
        currency: normalizeYahooCurrency(quote.currency || 'USD'),
      }
    })

    // 5. Comprobar alertas
    const triggeredAlerts = []
    
    for (const alerta of alertas) {
      const current = pricesMap[alerta.ticker.toUpperCase()]
      if (!current) continue

      let shouldTrigger = false
      let priceReached = current.price

      if (alerta.condition === 'above' && current.high >= alerta.target_price) {
        shouldTrigger = true
        priceReached = current.high >= alerta.target_price && current.price < alerta.target_price ? current.high : current.price
      } else if (alerta.condition === 'below' && current.low <= alerta.target_price) {
        shouldTrigger = true
        priceReached = current.low <= alerta.target_price && current.price > alerta.target_price ? current.low : current.price
      }

      if (shouldTrigger) {
        triggeredAlerts.push({
          alerta,
          currentPrice: current.price,
          reachedPrice: priceReached,
          currency: current.currency
        })
      }
    }

    if (triggeredAlerts.length === 0) {
      return NextResponse.json({ message: 'No alerts triggered' })
    }

    // 6. Enviar mensajes por Telegram y actualizar Supabase
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

    let notificationsFailed = 0
    for (const trigger of triggeredAlerts) {
      let notificationDelivered = true
      // Enviar Telegram
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const accion = trigger.alerta.condition === 'above' ? '📈 SUPERADO' : '📉 CAÍDO POR DEBAJO DE'
        const emoji = trigger.alerta.condition === 'above' ? '🚀' : '🔻'
        const targetFormateado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: trigger.currency }).format(trigger.alerta.target_price)
        const currentFormateado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: trigger.currency }).format(trigger.currentPrice)
        const reachedFormateado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: trigger.currency }).format(trigger.reachedPrice)

        const mensaje = `
${emoji} *¡ALERTA DE PRECIO SILOX!* ${emoji}

El activo *${trigger.alerta.ticker}* ha ${accion} tu objetivo.

🎯 Objetivo: ${targetFormateado}
💰 Precio Actual: ${currentFormateado}
${trigger.currentPrice !== trigger.reachedPrice ? `⚡ *¡OJO!* Tocó los ${reachedFormateado} hoy, pero ahora ha rebotado a ${currentFormateado}.` : ''}
`
        try {
          const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: mensaje,
              parse_mode: 'Markdown'
            })
          })
          if (!response.ok) throw new Error(`Telegram returned ${response.status}`)
        } catch (error) {
          notificationDelivered = false
          notificationsFailed += 1
          console.error('Error sending Telegram message', error)
        }
      }

      if (!notificationDelivered) continue

      const { error: deleteError } = await supabase
        .from('alertas')
        .delete()
        .eq('id', trigger.alerta.id)

      if (deleteError) throw deleteError
    }

    return NextResponse.json({ 
      message: `Processed ${alertas.length} alerts. Triggered ${triggeredAlerts.length}.`,
      notificationsFailed,
    })

  } catch (error: unknown) {
    console.error('Cron job error:', error)
    const message = error instanceof Error ? error.message : 'Unknown alert cron error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
