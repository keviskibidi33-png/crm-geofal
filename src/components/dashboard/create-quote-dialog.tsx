"use client"

const DEFAULT_COTIZADOR_URL = "http://localhost:5173"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertCircle, ExternalLink } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { logActionClient as logAction } from "@/lib/audit-client"
import { supabase } from "@/lib/supabaseClient"

interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iframeUrl?: string
  user?: { id: string; name: string; email?: string; phone?: string }
  onSuccess?: () => void
  proyectoId?: string
  clienteId?: string
  quoteId?: string
}

const COTIZADORA_BRIDGE_DEBUG = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_IFRAME_BRIDGE === "true"

const cotizadoraDebugLog = (message: string, payload?: unknown) => {
  if (COTIZADORA_BRIDGE_DEBUG) {
    console.info(`[CotizadoraBridge] ${message}`, payload)
  }
}

export function CreateQuoteDialog({ open, onOpenChange, iframeUrl, user, onSuccess, proyectoId, clienteId, quoteId }: CreateQuoteDialogProps) {
  const [iframeToken, setIframeToken] = useState<string | null>(null)
  const liveTokenRef = useRef<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const baseUrl = iframeUrl ?? process.env.NEXT_PUBLIC_COTIZADOR_URL ?? DEFAULT_COTIZADOR_URL
  const iframeOrigin = useMemo(() => {
    try {
      return new URL(baseUrl).origin
    } catch {
      return null
    }
  }, [baseUrl])

  const getStoredAccessToken = useCallback((): string | null => {
    if (typeof window === "undefined") return null

    const directToken = localStorage.getItem("token")
    if (directToken) return directToken

    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (!/^sb-.*-auth-token$/.test(key)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token
        if (typeof parsed?.session?.access_token === "string" && parsed.session.access_token) return parsed.session.access_token
      } catch {
        // ignore malformed entries
      }
    }
    return null
  }, [])

  const syncIframeToken = useCallback(async (reason = "generic", bootstrap = false): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    const sessionToken = session?.access_token ?? null
    const localToken = getStoredAccessToken()
    let freshToken = sessionToken ?? localToken

    if (!freshToken) {
      try {
        const { data } = await supabase.auth.refreshSession()
        freshToken = data?.session?.access_token ?? getStoredAccessToken()
      } catch {
        // ignore refresh failures; child will handle session expiry if truly needed
      }
    }

    liveTokenRef.current = freshToken
    if (freshToken && typeof window !== "undefined") {
      localStorage.setItem("token", freshToken)
    }
    if (bootstrap) {
      setIframeToken(freshToken)
    }

    cotizadoraDebugLog("syncIframeToken", {
      reason,
      session: !!sessionToken,
      local: !!localToken,
      resolved: !!freshToken,
      bootstrap,
    })

    return freshToken
  }, [getStoredAccessToken])

  useEffect(() => {
    if (!open) {
      setIframeToken(null)
      liveTokenRef.current = null
      return
    }
    void syncIframeToken("dialog-open", true)
  }, [open, syncIframeToken])

  // Build URL with user params and context for auto-fill
  let resolvedIframeUrl = baseUrl
  const params = new URLSearchParams()

  // Pass auth token
  if (iframeToken) params.set('token', iframeToken)

  if (user) {
    params.set('user_id', user.id)
    params.set('name', user.name)
    if (user.email) params.set('email', user.email)
    if (user.phone) params.set('phone', user.phone)
  }

  if (proyectoId) params.set('proyecto_id', proyectoId)
  if (clienteId) params.set('cliente_id', clienteId)
  if (quoteId) params.set('quote_id', quoteId)

  const queryString = params.toString()
  if (queryString) {
    resolvedIframeUrl += (resolvedIframeUrl.includes('?') ? '&' : '?') + queryString
  }
  const iframeAvailable = baseUrl.length > 0

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!open || !event.source) return
      if (iframeOrigin && event.origin !== iframeOrigin) return
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

      // Auto-refresh: iframe requests a fresh token before expiry
      if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
        const requestId = typeof event.data?.requestId === "string" ? event.data.requestId : undefined
        const immediateToken = liveTokenRef.current || getStoredAccessToken()

        if (immediateToken) {
          ;(event.source as Window).postMessage(
            { type: 'TOKEN_REFRESH', token: immediateToken, requestId, source: 'create_quote_dialog_immediate' },
            event.origin
          )
        }

        syncIframeToken(`request:${requestId || "none"}`).then((freshToken) => {
          if (freshToken && event.source) {
            ;(event.source as Window).postMessage(
              { type: 'TOKEN_REFRESH', token: freshToken, requestId, source: 'create_quote_dialog_sync' },
              event.origin
            )
          }
        })
        return
      }

      if (event.data?.type === 'AUTH_REQUIRED' && event.source) {
        const requestId = typeof event.data?.requestId === "string" ? event.data.requestId : undefined
        syncIframeToken(`auth-required:${requestId || "none"}`).then((freshToken) => {
          if (freshToken && event.source) {
            ;(event.source as Window).postMessage(
              { type: 'TOKEN_REFRESH', token: freshToken, requestId, source: 'create_quote_dialog_recovery' },
              event.origin
            )
            return
          }
          toast.error("No se pudo renovar la sesión de la cotizadora. Reabre el módulo.")
        })
        return
      }

      // Security: In production we should check event.origin
      if (event.data?.type === 'QUOTE_CREATED' || event.data?.type === 'QUOTE_UPDATED') {
        const isUpdate = event.data?.type === 'QUOTE_UPDATED'
        toast.success(isUpdate ? "Cotización actualizada" : "Cotización creada", {
          description: isUpdate
            ? "Los cambios se han guardado correctamente."
            : "La cotización se ha generado y guardado correctamente.",
        })
        if (onSuccess) onSuccess()

        // Log action
        // Check for quote data and construct code if necessary
        const quote = event.data.quote || event.data.payload?.quote
        const quoteCode = quote?.code || (quote?.numero && quote?.year ? `COT-${quote.numero}-${quote.year}` : null)

        if (user) {
          logAction({
            user_id: user.id,
            user_name: user.name,
            action: isUpdate
              ? `Editó cotización ${quoteCode || ''}`
              : `Generó nueva cotización ${quoteCode || ''}`,
            module: "COTIZACIONES",
            details: { codigo: quoteCode, cotizacion_id: quote?.id }
          })
        }

        // Optionally close dialog after short delay
        setTimeout(() => onOpenChange(false), 1500)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [getStoredAccessToken, iframeOrigin, onOpenChange, onSuccess, open, syncIframeToken, user])

  const handleUnavailable = () => {
    toast.error("Cotizadora no configurada", {
      description:
        "Define la variable NEXT_PUBLIC_COTIZADOR_URL o pasa iframeUrl al componente para habilitar la cotizadora.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[98vw] w-full h-[95vh] bg-card border-border flex flex-col gap-2 overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base">{quoteId ? 'Editar cotización' : 'Generar cotización'}</DialogTitle>
              <DialogDescription className="text-xs">
                {quoteId ? 'Modifica los detalles de la cotización existente' : 'Completa la cotización sin salir del CRM'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="whitespace-nowrap text-xs">
                Integrada
              </Badge>
              <Button variant="outline" size="sm" asChild disabled={!iframeAvailable}>
                <a
                  href={iframeAvailable ? baseUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={!iframeAvailable ? (e) => {
                    e.preventDefault()
                    handleUnavailable()
                  } : undefined}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Nueva pestaña
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="h-full bg-white overflow-hidden flex flex-col">
            {iframeAvailable ? (
              iframeToken ? (
                <iframe
                  ref={iframeRef}
                  src={resolvedIframeUrl}
                  className="w-full flex-1 border-0 rounded-b-lg"
                  title="Generador de Cotizaciones"
                  allow="clipboard-write"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-base font-medium">Sincronizando sesión segura</p>
                  <p className="text-sm text-muted-foreground">
                    Espera un momento mientras se renueva el acceso de la cotizadora.
                  </p>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-base font-medium">Configura la URL de la cotizadora</p>
                <p className="text-sm text-muted-foreground">
                  Define la variable <code className="px-1 py-0.5 rounded bg-muted">NEXT_PUBLIC_COTIZADOR_URL</code> en tu
                  entorno.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
