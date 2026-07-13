import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { normalizeYahooCurrency } from '@/lib/utils/currency'
import { apiError, apiSuccess } from '@/lib/api/responses'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export const dynamic = 'force-dynamic'

interface PriceAlertRow {
  id: string
  user_id: string
  ticker: string
  target_price: number
  condition: 'above' | 'below'
  triggered: boolean
}

interface TriggeredAlert {
  alerta: PriceAlertRow
  currentPrice: number
  reachedPrice: number
  currency: string
}

interface NotificationPreferenceRow {
  user_id: string
  price_alerts: boolean
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return apiError(request, 500, 'configuration_error', 'Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Verificar seguridad del cron (Vercel Cron Secret u otra clave)
    const authHeader = request.headers.get('authorization')
    
    if (!process.env.CRON_SECRET) {
      return apiError(request, 500, 'configuration_error', 'CRON_SECRET not configured')
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError(request, 401, 'unauthorized', 'Unauthorized')
    }

    // 2. Obtener las alertas activas (no disparadas)
    const { data: alertas, error: alertsError } = await supabase
      .from('alertas')
      .select('*')
      .eq('triggered', false)

    if (alertsError) throw alertsError
    if (!alertas || alertas.length === 0) {
      return apiSuccess(request, { message: 'No active alerts to check', processed: 0, triggered: 0, notified: 0 })
    }

    const typedAlerts = alertas as PriceAlertRow[]

    // 3. Extraer todos los tickers únicos necesarios
    const uniqueTickers = Array.from(new Set(typedAlerts.map(a => a.ticker)))

    // 4. Obtener precios de Yahoo Finance (en paralelo)
    const pricesMap: Record<string, { price: number; high: number; low: number; currency: string }> = {}
    await Promise.allSettled(
      uniqueTickers.map(async (ticker) => {
        try {
          const quote = await yahooFinance.quote(ticker)
          if (quote.regularMarketPrice) {
            pricesMap[ticker.toUpperCase()] = {
              price: quote.regularMarketPrice,
              high: quote.regularMarketDayHigh || quote.regularMarketPrice,
              low: quote.regularMarketDayLow || quote.regularMarketPrice,
              currency: normalizeYahooCurrency(quote.currency || 'USD')
            }
          }
        } catch (e) {
          console.error(`Failed to fetch price for ${ticker}`, e)
        }
      })
    )

    // 5. Comprobar alertas
    const triggeredAlerts: TriggeredAlert[] = []
    
    for (const alerta of typedAlerts) {
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
      return apiSuccess(request, { message: 'No alerts triggered', processed: typedAlerts.length, triggered: 0, notified: 0 })
    }

    const userIds = Array.from(new Set(triggeredAlerts.map((trigger) => trigger.alerta.user_id)))
    const notificationPreferenceByUser = new Map<string, boolean>()
    const { data: notificationPreferences, error: notificationError } = await supabase
      .from('notification_preferences')
      .select('user_id, price_alerts')
      .in('user_id', userIds)

    if (notificationError && !['42P01', 'PGRST205', 'PGRST116'].includes(notificationError.code)) {
      throw notificationError
    }

    const typedNotificationPreferences = (notificationPreferences ?? []) as NotificationPreferenceRow[]
    typedNotificationPreferences.forEach((preference) => {
      notificationPreferenceByUser.set(preference.user_id, preference.price_alerts)
    })

    // 6. Marcar alertas cumplidas y enviar mensajes por Telegram si procede.
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
    let notificationsSent = 0

    for (const trigger of triggeredAlerts) {
      const { error: updateError } = await supabase
        .from('alertas')
        .update({ triggered: true })
        .eq('id', trigger.alerta.id)

      if (updateError) throw updateError

      const shouldNotify = notificationPreferenceByUser.get(trigger.alerta.user_id) ?? true
      if (shouldNotify && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
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
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: mensaje,
              parse_mode: 'Markdown'
            })
          })
          notificationsSent++
        } catch (e) {
          console.error('Error sending Telegram message', e)
        }
      }
    }

    return apiSuccess(request, {
      message: `Processed ${typedAlerts.length} alerts. Triggered ${triggeredAlerts.length}.`,
      processed: typedAlerts.length,
      triggered: triggeredAlerts.length,
      notified: notificationsSent,
    })

  } catch (error: unknown) {
    console.error('Cron job error:', error)
    return apiError(request, 500, 'internal_error', error instanceof Error ? error.message : 'Cron job error')
  }
}
