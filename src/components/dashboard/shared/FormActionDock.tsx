import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Download,
    Loader2,
    Save,
    Trash2,
    Pin,
    PinOff,
    ChevronDown,
    ChevronUp,
    Sparkles,
} from 'lucide-react'

export type DockMode = 'auto' | 'pinned' | 'floating'

export interface FormActionDockProps {
    onSave: () => void
    onSaveAndDownload: () => void
    onClear?: () => void
    loading?: boolean
    saving?: boolean
    downloading?: boolean
    saveDisabled?: boolean
    downloadDisabled?: boolean
    clearDisabled?: boolean
    saveTooltip?: string
    downloadTooltip?: string
    clearTooltip?: string
    saveLabel?: string
    downloadLabel?: string
    clearLabel?: string
    className?: string
    showTextOnDesktop?: boolean
}

const STORAGE_KEY = 'geofal_dock_mode'

export default function FormActionDock({
    onSave,
    onSaveAndDownload,
    onClear,
    loading = false,
    saving = false,
    downloading = false,
    saveDisabled = false,
    downloadDisabled = false,
    clearDisabled = false,
    saveTooltip = "Guardar (mantiene el formulario abierto)",
    downloadTooltip = "Guardar y Descargar Excel (cierra el formulario)",
    clearTooltip = "Limpiar datos no guardados",
    saveLabel = "Guardar",
    downloadLabel = "Guardar y Descargar",
    clearLabel = "Limpiar",
    className = "",
    showTextOnDesktop = true,
}: FormActionDockProps) {
    const isBusy = loading || saving || downloading
    const dockRef = useRef<HTMLDivElement>(null)

    // Estados de modo y scroll
    const [dockMode, setDockMode] = useState<DockMode>('auto')
    const [isScrolledDown, setIsScrolledDown] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

    // Cargar preferencia guardada en localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as DockMode | null
            if (saved === 'auto' || saved === 'pinned' || saved === 'floating') {
                setDockMode(saved)
            }
        } catch {
            // ignore
        }
    }, [])

    const toggleDockMode = useCallback(() => {
        setDockMode((prev) => {
            const next: DockMode = prev === 'auto' ? 'pinned' : prev === 'pinned' ? 'floating' : 'auto'
            try {
                localStorage.setItem(STORAGE_KEY, next)
            } catch {
                // ignore
            }
            return next
        })
    }, [])

    // Detección de scroll inteligente en el contenedor padre o ventana
    useEffect(() => {
        if (dockMode === 'pinned' || dockMode === 'floating') return

        const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
            if (!node) return null
            let parent = node.parentElement
            while (parent) {
                const { overflowY } = window.getComputedStyle(parent)
                if (overflowY === 'auto' || overflowY === 'scroll') {
                    return parent
                }
                parent = parent.parentElement
            }
            return null
        }

        const target = findScrollParent(dockRef.current) || window

        const handleScroll = () => {
            if (target === window) {
                const scrollY = window.scrollY || document.documentElement.scrollTop
                const totalHeight = document.documentElement.scrollHeight - window.innerHeight
                const isNearBottom = totalHeight - scrollY < 200 || scrollY > 180
                setIsScrolledDown(isNearBottom)
            } else {
                const el = target as HTMLElement
                const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160 || el.scrollTop > 140
                setIsScrolledDown(isNearBottom)
            }
        }

        target.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()

        return () => {
            target.removeEventListener('scroll', handleScroll)
        }
    }, [dockMode])

    // Determinar si actualmente debe mostrarse anclado abajo (barra completa)
    const isDocked = dockMode === 'pinned' || (dockMode === 'auto' && isScrolledDown)

    // Renderizado en Modo Minimizado (Pill flotante compacto)
    if (isMinimized) {
        return (
            <div
                ref={dockRef}
                className={`fixed bottom-4 right-4 z-50 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-full shadow-2xl border border-slate-200/90 dark:border-slate-800 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 ${className}`.trim()}
            >
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isBusy || saveDisabled}
                    title={saveTooltip}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-40"
                    aria-label={saveLabel}
                >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
                <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all text-xs font-bold"
                    title="Expandir barra de acciones"
                >
                    <ChevronUp className="h-4 w-4" />
                </button>
            </div>
        )
    }

    // Estilos según si está anclado (Footer completo) o flotante
    const containerClasses = isDocked
        ? `fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between sm:justify-end gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 pointer-events-auto ${className}`.trim()
        : `fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center justify-end sm:justify-center gap-2 sm:gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto ${className}`.trim()

    return (
        <div ref={dockRef} className={containerClasses} role="toolbar" aria-label="Acciones del formulario">
            {/* Controles de Vista (Pin / Modo inteligente / Minimizar) */}
            <div className="flex items-center gap-1 mr-auto sm:mr-1 border-r border-slate-200 dark:border-slate-700 pr-1.5">
                <button
                    type="button"
                    onClick={toggleDockMode}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all text-xs ${
                        dockMode === 'pinned'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-bold'
                            : dockMode === 'auto'
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={
                        dockMode === 'pinned'
                            ? 'Modo: Siempre Anclado al pie (Click para cambiar a Flotante)'
                            : dockMode === 'auto'
                            ? 'Modo: Inteligente con Scroll (Click para Anclar fijo al pie)'
                            : 'Modo: Siempre Flotante (Click para Modo Inteligente)'
                    }
                    aria-label="Alternar modo de anclaje"
                >
                    {dockMode === 'pinned' ? (
                        <Pin className="h-4 w-4 fill-current text-blue-600" />
                    ) : dockMode === 'auto' ? (
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                        <PinOff className="h-4 w-4" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    title="Minimizar barra"
                    aria-label="Minimizar barra"
                >
                    <ChevronDown className="h-4 w-4" />
                </button>
            </div>

            {/* Botón Limpiar Borrador */}
            {onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    disabled={isBusy || clearDisabled}
                    title={clearTooltip}
                    className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                    aria-label={clearLabel}
                >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
            )}

            {/* Botón Guardar (Secundario) */}
            <button
                type="button"
                onClick={onSave}
                disabled={isBusy || saveDisabled}
                title={saveTooltip}
                className="flex h-10 px-3 sm:h-11 sm:px-3.5 items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 border border-slate-200/80 dark:border-slate-700 transition-all shadow-xs font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                aria-label={saveLabel}
            >
                {saving || (loading && !downloading) ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-slate-600" />
                ) : (
                    <Save className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700 dark:text-slate-200" />
                )}
                {showTextOnDesktop && <span className="hidden md:inline">{saveLabel}</span>}
            </button>

            {/* Botón Guardar y Exportar (Primario) */}
            <button
                type="button"
                onClick={onSaveAndDownload}
                disabled={isBusy || downloadDisabled}
                title={downloadTooltip}
                className="flex h-10 px-3.5 sm:h-11 sm:px-4 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                aria-label={downloadLabel}
            >
                {downloading || (loading && downloading) ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-white" />
                ) : (
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                )}
                {showTextOnDesktop && <span>{downloadLabel}</span>}
            </button>
        </div>
    )
}

