"use client"

import { useEffect } from "react"

const SECURITY_MSG = () => {
    console.log(
        '%c⛔ ACCESO AUDITADO',
        'color:#ff0000;font-size:28px;font-weight:900;text-shadow:1px 1px 2px #000;'
    )
    console.log(
        '%cTODOS LOS INTENTOS DE ACCESO SON REGISTRADOS Y AUDITADOS MEDIANTE IP',
        'color:#ff4444;font-size:14px;font-weight:700;'
    )
    console.log(
        '%cSE REQUIERE AUTENTICACIÓN VÁLIDA',
        'color:#ff4444;font-size:14px;font-weight:700;'
    )
    console.log(
        '%cCualquier intento no autorizado será reportado a las autoridades competentes.\nGeofal CRM — Sistema de Gestión Protegido.',
        'color:#888;font-size:11px;'
    )
}

export function SecurityShield() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return

        // --- Show warning on load ---
        SECURITY_MSG()

        // --- Right-click protection ---
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }

        // --- Keyboard shortcut protection (F12, Ctrl+Shift+I/J/C, Ctrl+U) ---
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
                (e.ctrlKey && ['u', 'U'].includes(e.key))
            ) {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        // --- DevTools size-based detection ---
        let devtoolsDetected = false

        const detectBySize = () => {
            const widthDiff = window.outerWidth - window.innerWidth > 200
            const heightDiff = window.outerHeight - window.innerHeight > 300

            if ((widthDiff || heightDiff) && !devtoolsDetected) {
                devtoolsDetected = true
                console.clear()
                SECURITY_MSG()
            } else if (!widthDiff && !heightDiff) {
                devtoolsDetected = false
            }
        }

        document.addEventListener('contextmenu', handleContextMenu)
        document.addEventListener('keydown', handleKeyDown)

        const sizeInterval = setInterval(detectBySize, 2000)

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu)
            document.removeEventListener('keydown', handleKeyDown)
            clearInterval(sizeInterval)
        }
    }, [])

    return null
}
