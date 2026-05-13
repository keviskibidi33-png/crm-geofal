export function getSafeErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (!error) return fallback
  if (typeof error === "string") return error.trim() || fallback
  if (error instanceof Error) return error.message || fallback

  if (Array.isArray(error)) {
    const joined = error
      .map((entry) => getSafeErrorMessage(entry, ""))
      .filter(Boolean)
      .join("; ")
    return joined || fallback
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    const nested = record.detail ?? record.message ?? record.msg ?? record.error
    if (nested) return getSafeErrorMessage(nested, fallback)

    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }

  return fallback
}
