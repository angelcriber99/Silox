import { createClient } from "@/lib/supabase/server"
import { apiError, apiSuccess } from "@/lib/api/responses"

export const dynamic = "force-dynamic"

type HealthStatus = "ok" | "warning" | "error"

interface HealthCheck {
  id: string
  label: string
  status: HealthStatus
  detail: string
}

async function tableCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  label: string,
): Promise<HealthCheck> {
  const { error } = await (supabase as any)
    .from(table)
    .select("*", { count: "exact", head: true })

  if (!error) {
    return { id: table, label, status: "ok", detail: "Tabla accesible con RLS" }
  }

  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST116") {
    return { id: table, label, status: "warning", detail: "Migración pendiente o tabla no expuesta" }
  }

  return { id: table, label, status: "error", detail: error.message }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return apiError(request, 401, "unauthorized", "No autorizado")
  }

  const checks: HealthCheck[] = [
    {
      id: "supabase-url",
      label: "Supabase URL",
      status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "ok" : "error",
      detail: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configurada" : "Falta NEXT_PUBLIC_SUPABASE_URL",
    },
    {
      id: "supabase-anon",
      label: "Supabase anon key",
      status: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ok" : "error",
      detail: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configurada" : "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY",
    },
    {
      id: "service-role",
      label: "Supabase service role",
      status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "warning",
      detail: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Configurada para crons y borrado de cuenta" : "Falta SUPABASE_SERVICE_ROLE_KEY",
    },
    {
      id: "cron-secret",
      label: "Cron secret",
      status: process.env.CRON_SECRET ? "ok" : "warning",
      detail: process.env.CRON_SECRET ? "Configurado para tareas programadas" : "Falta CRON_SECRET",
    },
    {
      id: "gemini",
      label: "Gemini API",
      status: process.env.GEMINI_API_KEY ? "ok" : "warning",
      detail: process.env.GEMINI_API_KEY ? "Configurada para Silox AI" : "Falta GEMINI_API_KEY",
    },
  ]

  checks.push(
    await tableCheck(supabase, "imports", "Auditoría de importaciones"),
    await tableCheck(supabase, "notification_preferences", "Preferencias de notificación"),
    await tableCheck(supabase, "budget_settings", "Presupuesto mensual"),
    await tableCheck(supabase, "expenses", "Gastos"),
    await tableCheck(supabase, "portfolio_snapshots", "Snapshots diarios"),
  )

  const status: HealthStatus = checks.some((check) => check.status === "error")
    ? "error"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "ok"

  return apiSuccess(request, {
    status,
    checkedAt: new Date().toISOString(),
    checks,
  })
}
