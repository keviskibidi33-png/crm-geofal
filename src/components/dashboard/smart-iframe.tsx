"use client"

/**
 * SmartIframe — Shared iframe component with simplified, robust loading detection.
 *
 * Strategy (dual-signal with absolute fallback):
 *   Signal 1 (fast):     IFRAME_READY postMessage → show immediately
 *   Signal 2 (fallback): iframe onLoad event → wait 1.5s grace, then show
 *   Signal 3 (absolute): 8s hard timeout → show iframe regardless
 *
 * Compared to the previous implementation, this removes:
 *   - Automatic retries with key remounting (caused full iframe reload loops)
 *   - setInterval polling with PING_IFRAME_READY every 3s (noisy, memory leak)
 *   - Progressive timeout tiers (12s, 20s, 30s — too long)
 *   - retryCount state and retry badge UI
 *   - URL cache-busting via ?retry= param
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SmartIframeProps {
    /** Full URL of the microfrontend to embed */
    src: string
    /** Accessible title for the iframe element */
    title: string
    /** Optional JWT token to pass via URL query parameter for immediate auth */
    token?: string | null
}

/** Max time to wait before showing iframe regardless of handshake status */
const ABSOLUTE_FALLBACK_MS = 8000
/** Grace period after onLoad to allow IFRAME_READY to arrive via postMessage */
const ONLOAD_GRACE_MS = 1500

export function SmartIframe({ src, title, token }: SmartIframeProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const completedRef = useRef(false)

    // ── Parse and validate the source URL ──
    const parsedSrc = useMemo(() => {
        try {
            return new URL(src)
        } catch {
            return null
        }
    }, [src])

    const expectedOrigin = parsedSrc?.origin ?? null

    const configurationError = useMemo(() => {
        if (!parsedSrc) {
            return "La URL del módulo es inválida."
        }

        const host = parsedSrc.hostname.toLowerCase()
        if (
            typeof window !== "undefined" &&
            (host === "localhost" || host === "127.0.0.1") &&
            parsedSrc.origin.toLowerCase() === window.location.origin.toLowerCase()
        ) {
            return "Configuración inválida: la URL del módulo apunta al mismo origen del CRM. Verifica las variables de entorno."
        }

        if (process.env.NODE_ENV === "production" && (host === "localhost" || host === "127.0.0.1")) {
            return "Configuración inválida en producción: la URL del módulo apunta a localhost."
        }

        return null
    }, [parsedSrc])

    // ── Build the final iframe src with optional token ──
    const finalSrc = useMemo(() => {
        if (!parsedSrc) return src
        const url = new URL(parsedSrc.toString())
        if (token) {
            url.searchParams.set("token", token)
        }
        return url.toString()
    }, [parsedSrc, src, token])

    // ── Core: mark loading as complete (idempotent) ──
    const completeLoad = useCallback(() => {
        if (completedRef.current) return
        completedRef.current = true
        setIsLoading(false)
        setError(null)
    }, [])

    // ── Reset state when src changes ──
    useEffect(() => {
        completedRef.current = false
        setIsLoading(true)
        setError(null)

        if (configurationError) {
            setError(configurationError)
            setIsLoading(false)
            return
        }
    }, [src, configurationError])

    // ── Signal 1: Listen for IFRAME_READY postMessage (fast path) ──
    useEffect(() => {
        if (!expectedOrigin || configurationError) return

        const handleMessage = (event: MessageEvent) => {
            // Security: only accept messages from the expected origin
            if (event.origin !== expectedOrigin) return
            if (event.data?.type !== "IFRAME_READY") return

            // Send acknowledgment back to iframe
            try {
                ;(event.source as Window | null)?.postMessage(
                    { type: "IFRAME_READY_ACK", source: "crm-shell" },
                    event.origin
                )
            } catch {
                // Ignore — source may have navigated away
            }

            completeLoad()
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [expectedOrigin, completeLoad, configurationError])

    // ── Signal 3: Absolute fallback timeout ──
    useEffect(() => {
        if (configurationError || !isLoading) return

        const fallbackTimer = setTimeout(() => {
            if (!completedRef.current) {
                console.info("[SmartIframe] Fallback timeout reached — showing iframe")
                completeLoad()
            }
        }, ABSOLUTE_FALLBACK_MS)

        return () => clearTimeout(fallbackTimer)
    }, [src, configurationError, isLoading, completeLoad])

    // ── Signal 2: onLoad handler (iframe HTML loaded) ──
    const handleIframeLoad = useCallback(() => {
        if (completedRef.current) return

        // Send a single ping to the iframe to trigger its IFRAME_READY response
        try {
            iframeRef.current?.contentWindow?.postMessage(
                { type: "PING_IFRAME_READY", source: "crm-shell" },
                "*"
            )
        } catch {
            // Cross-origin restriction — expected in production
        }

        // Grace period: if IFRAME_READY doesn't arrive in time, show anyway
        const graceTimer = setTimeout(() => {
            completeLoad()
        }, ONLOAD_GRACE_MS)

        // If completeLoad was already called (by IFRAME_READY), this is a no-op
        return () => clearTimeout(graceTimer)
    }, [completeLoad])

    // ── Manual retry (only for config/load errors) ──
    const handleRetry = useCallback(() => {
        completedRef.current = false
        setIsLoading(true)
        setError(null)
        // Force iframe reload by briefly unmounting — update key via state
        iframeRef.current?.contentWindow?.location.reload()
    }, [])

    return (
        <div className="w-full h-full relative bg-gray-50">
            {/* Loading overlay */}
            {isLoading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 backdrop-blur-sm transition-all duration-300">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse text-center">
                        Conectando con el módulo... <br />
                        <span className="text-xs opacity-75">
                            Esto puede tardar unos segundos si el sistema está "frío".
                        </span>
                    </p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Conexión Interrumpida</h3>
                    <p className="text-sm text-gray-500 max-w-xs mb-8 leading-relaxed">
                        {error} <br />
                        Es posible que el servicio esté reiniciándose o experimentando alta carga.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Recargar Página
                        </Button>
                        <Button onClick={handleRetry} className="gap-2 shadow-md hover:shadow-lg transition-all">
                            <RefreshCw className="h-4 w-4" />
                            Reintentar Conexión
                        </Button>
                    </div>
                </div>
            )}

            {/* Iframe */}
            <iframe
                ref={iframeRef}
                src={finalSrc}
                className={`w-full h-full border-none transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"}`}
                title={title}
                onLoad={handleIframeLoad}
                onError={() => {
                    setIsLoading(false)
                    setError("Error al cargar el módulo. Verifica que el servicio esté disponible.")
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="eager"
            />
        </div>
    )
}
