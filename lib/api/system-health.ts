export type SystemHealthStatus = "ok" | "warning" | "error"

export interface SystemHealthCheck {
  id: string
  label: string
  status: SystemHealthStatus
  detail: string
}

export interface SystemHealthPayload {
  status: SystemHealthStatus
  checkedAt: string
  checks: SystemHealthCheck[]
  requestId: string
}

export async function fetchSystemHealth(): Promise<SystemHealthPayload> {
  const response = await fetch("/api/system/health", { cache: "no-store" })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || "No se pudo cargar el estado del sistema")
  }

  return data as SystemHealthPayload
}
