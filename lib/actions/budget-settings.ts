"use server"

import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export const BudgetSettingsSchema = z.object({
  monthly_allowance: z.coerce.number().nonnegative("El ahorro mensual no puede ser negativo"),
})

export type BudgetSettings = z.infer<typeof BudgetSettingsSchema>

export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  monthly_allowance: 500,
}

function isMissingBudgetTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST116"
}

export async function getBudgetSettingsAction(): Promise<BudgetSettings> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No estás autenticado")

  const { data, error } = await supabase
    .from("budget_settings")
    .select("monthly_allowance")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    if (isMissingBudgetTable(error)) return DEFAULT_BUDGET_SETTINGS
    throw new Error(`Error cargando presupuesto: ${error.message}`)
  }

  if (!data) return DEFAULT_BUDGET_SETTINGS
  return BudgetSettingsSchema.parse(data)
}

export async function updateBudgetSettingsAction(updates: Partial<BudgetSettings>): Promise<BudgetSettings> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No estás autenticado")

  const current = await getBudgetSettingsAction()
  const next = BudgetSettingsSchema.parse({ ...current, ...updates })

  const { data, error } = await supabase
    .from("budget_settings")
    .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" })
    .select("monthly_allowance")
    .single()

  if (error) {
    if (isMissingBudgetTable(error)) return next
    throw new Error(`Error actualizando presupuesto: ${error.message}`)
  }

  return BudgetSettingsSchema.parse(data)
}
