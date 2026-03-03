'use client'

import { useEffect, useCallback } from 'react'

interface ProgramacionMessage {
    type: 'PROGRAMACION_UPDATED' | 'PROGRAMACION_SAVED' | 'PROGRAMACION_CLOSE'
    data?: any
}

const getProgramacionOrigin = (): string | null => {
    const configuredUrl = process.env.NEXT_PUBLIC_PROGRAMACION_URL
    if (!configuredUrl) return null
    try {
        return new URL(configuredUrl).origin
    } catch {
        return null
    }
}

export function useProgramacionIframe(onUpdate?: () => void) {
    useEffect(() => {
        const allowedOrigin = getProgramacionOrigin()

        const handleMessage = (event: MessageEvent<ProgramacionMessage>) => {
            // Validar origen en producción
            if (process.env.NODE_ENV === 'production') {
                if (!allowedOrigin || event.origin !== allowedOrigin) return
            }

            if (event.data?.type === 'PROGRAMACION_UPDATED' || event.data?.type === 'PROGRAMACION_SAVED') {
                onUpdate?.()
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onUpdate])

    const sendMessage = useCallback((message: any) => {
        const iframe = document.querySelector('iframe[data-programacion-iframe]') as HTMLIFrameElement
        if (iframe?.contentWindow) {
            // Enviar al origen configurado (normalizado) o * si no está definido (dev)
            const targetOrigin = getProgramacionOrigin() || '*'
            iframe.contentWindow.postMessage(message, targetOrigin)
        }
    }, [])

    return { sendMessage }
}
