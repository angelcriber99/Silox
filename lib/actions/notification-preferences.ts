"use server"

import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export const NotificationPreferencesSchema = z.object({
  push_notifs: z.boolean(),
  email_notifs: z.boolean(),
  price_alerts: z.boolean(),
  weekly_report: z.boolean(),
  dividend_alerts: z.boolean(),
})

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_notifs: true,
  email_notifs: true,
  price_alerts: true,
  weekly_report: false,
  dividend_alerts: true,
}

export async function getNotificationPreferencesAction(): Promise<NotificationPreferences> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No estás autenticado")

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("push_notifs, email_notifs, price_alerts, weekly_report, dividend_alerts")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST116") {
      return DEFAULT_NOTIFICATION_PREFERENCES
    }
    throw new Error(`Error cargando preferencias de notificación: ${error.message}`)
  }

  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES
  return NotificationPreferencesSchema.parse(data)
}

export async function updateNotificationPreferencesAction(
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No estás autenticado")

  const current = await getNotificationPreferencesAction()
  const next = NotificationPreferencesSchema.parse({ ...current, ...updates })

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" })
    .select("push_notifs, email_notifs, price_alerts, weekly_report, dividend_alerts")
    .single()

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST116") {
      return next
    }
    throw new Error(`Error actualizando preferencias de notificación: ${error.message}`)
  }

  return NotificationPreferencesSchema.parse(data)
}
