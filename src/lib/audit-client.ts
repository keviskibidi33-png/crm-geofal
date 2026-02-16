export interface AuditLogPayload {
  user_id?: string
  user_name?: string
  action: string
  module?: string
  details?: any
  ip_address?: string
  severity?: "info" | "warning" | "error"
}

export async function logActionClient(data: AuditLogPayload) {
  try {
    const response = await fetch("/api/audit/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok || result?.error) {
      return { error: result?.error || "No se pudo registrar auditoría" }
    }

    return { success: true }
  } catch (error: any) {
    return { error: error?.message || "Error de red al registrar auditoría" }
  }
}
