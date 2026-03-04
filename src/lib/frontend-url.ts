const HTTP_PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//
const TRAILING_SLASH_REGEX = /\/+$/

function stripWrappingQuotes(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, "")
}

function normalizeCandidate(raw: string | undefined | null): string {
  const trimmed = stripWrappingQuotes(String(raw ?? "").trim())
  if (!trimmed) return ""
  if (trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return ""
  return trimmed
}

function ensureProtocol(value: string): string {
  if (!value) return value
  if (HTTP_PROTOCOL_REGEX.test(value)) return value
  if (value.startsWith("//")) return `https:${value}`
  if (value.startsWith("/")) return ""
  return `https://${value}`
}

function removeTrailingSlashes(value: string): string {
  return value.replace(TRAILING_SLASH_REGEX, "")
}

function parseAsHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed
  } catch {
    return null
  }
}

export function resolveFrontendModuleUrl(
  primaryValue: string | undefined | null,
  fallbackValue: string,
  moduleName: string,
): string {
  const fallbackNormalized = removeTrailingSlashes(fallbackValue.trim())
  const fallbackParsed = parseAsHttpUrl(fallbackNormalized)

  if (!fallbackParsed) {
    throw new Error(`Fallback URL invalida para modulo ${moduleName}: ${fallbackValue}`)
  }

  const primaryNormalized = normalizeCandidate(primaryValue)
  if (!primaryNormalized) return fallbackParsed.toString().replace(TRAILING_SLASH_REGEX, "")

  const primaryWithProtocol = ensureProtocol(primaryNormalized)
  const parsedPrimary = primaryWithProtocol ? parseAsHttpUrl(primaryWithProtocol) : null

  if (!parsedPrimary) {
    console.warn(`[${moduleName}] URL invalida en variable de entorno: "${primaryValue}". Usando fallback: "${fallbackParsed.toString()}".`)
    return fallbackParsed.toString().replace(TRAILING_SLASH_REGEX, "")
  }

  return removeTrailingSlashes(parsedPrimary.toString())
}
