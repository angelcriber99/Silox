import { apiError, apiSuccess } from "@/lib/api/responses"
import { createClient } from "@/lib/supabase/server"
import type { Transaccion } from "@/lib/types"
import { buildTaxReport } from "@/lib/utils/tax-report"

export const dynamic = "force-dynamic"

function parseYear(value: string | null): number | null {
  if (!value) return new Date().getFullYear()
  if (!/^\d{4}$/.test(value)) return null

  const year = Number(value)
  if (year < 2000 || year > 2100) return null
  return year
}

export async function GET(request: Request) {
  const year = parseYear(new URL(request.url).searchParams.get("year"))
  if (!year) {
    return apiError(request, 400, "validation_error", "El parametro year debe ser un ano de cuatro digitos.")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return apiError(request, 401, "unauthorized", "No autorizado")
  }

  const { data, error } = await supabase
    .from("transacciones")
    .select(`
      *,
      activo:activos(*)
    `)
    .order("fecha", { ascending: true })

  if (error) {
    return apiError(request, 500, "database_error", "No se pudieron obtener las transacciones fiscales.", {
      message: error.message,
    })
  }

  const report = buildTaxReport((data as unknown as Transaccion[]) ?? [], year)
  return apiSuccess(request, { report })
}
