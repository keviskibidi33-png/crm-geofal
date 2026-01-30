'use client'

import { useEffect, useCallback } from 'react'

interface ProgramacionMessage {
    type: 'PROGRAMACION_UPDATED' | 'PROGRAMACION_SAVED' | 'PROGRAMACION_CLOSE'
    data?: any
}

export function useProgramacionIframe(onUpdate?: () => void) {
    useEffect(() => {
        const handleMessage = (event: MessageEvent<ProgramacionMessage>) => {
            // Validar origen en producción
            if (process.env.NODE_ENV === 'production') {
                const allowedOrigin = process.env.NEXT_PUBLIC_PROGRAMACION_URL
                if (!allowedOrigin || !event.origin.startsWith(allowedOrigin)) return
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
            // Enviar al origen configurado o * si no está definido (dev)
            const targetOrigin = process.env.NEXT_PUBLIC_PROGRAMACION_URL || '*'
            iframe.contentWindow.postMessage(message, targetOrigin)
        }
    }, [])

    return { sendMessage }
}
