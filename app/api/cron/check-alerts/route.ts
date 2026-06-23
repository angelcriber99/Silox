import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { normalizeYahooCurrency } from '@/lib/utils/currency'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Verificar seguridad del cron (Vercel Cron Secret u otra clave)
    const authHeader = request.headers.get('authorization')
    const url = new URL(request.url)
    const secretParam = url.searchParams.get('secret')
    
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      secretParam !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Obtener las alertas activas (no disparadas)
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
    const pricesMap: Record<string, { price: number; currency: string }> = {}
    await Promise.allSettled(
      uniqueTickers.map(async (ticker) => {
        try {
          const quote = await yahooFinance.quote(ticker) as any
          if (quote.regularMarketPrice) {
            pricesMap[ticker.toUpperCase()] = {
              price: quote.regularMarketPrice,
              currency: normalizeYahooCurrency(quote.currency || 'USD')
            }
          }
        } catch (e) {
          console.error(`Failed to fetch price for ${ticker}`, e)
        }
      })
    )

    // 5. Comprobar alertas
    const triggeredAlerts = []
    
    for (const alerta of alertas) {
      const current = pricesMap[alerta.ticker.toUpperCase()]
      if (!current) continue

      let shouldTrigger = false
      if (alerta.condition === 'above' && current.price >= alerta.target_price) {
        shouldTrigger = true
      } else if (alerta.condition === 'below' && current.price <= alerta.target_price) {
        shouldTrigger = true
      }

      if (shouldTrigger) {
        triggeredAlerts.push({
          alerta,
          currentPrice: current.price,
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

    for (const trigger of triggeredAlerts) {
      // Marcar en DB como disparada
      await supabase
        .from('alertas')
        .update({ triggered: true })
        .eq('id', trigger.alerta.id)

      // Enviar Telegram
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const accion = trigger.alerta.condition === 'above' ? '📈 SUPERADO' : '📉 CAÍDO POR DEBAJO DE'
        const emoji = trigger.alerta.condition === 'above' ? '🚀' : '🔻'
        const targetFormateado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: trigger.currency }).format(trigger.alerta.target_price)
        const currentFormateado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: trigger.currency }).format(trigger.currentPrice)

        const mensaje = `
${emoji} *¡ALERTA DE PRECIO SILOX!* ${emoji}

El activo *${trigger.alerta.ticker}* ha ${accion} tu objetivo.

🎯 Objetivo: ${targetFormateado}
💰 Precio Actual: ${currentFormateado}
`
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: mensaje,
              parse_mode: 'Markdown'
            })
          })
        } catch (e) {
          console.error('Error sending Telegram message', e)
        }
      }
    }

    return NextResponse.json({ 
      message: `Processed ${alertas.length} alerts. Triggered ${triggeredAlerts.length}.` 
    })

  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
