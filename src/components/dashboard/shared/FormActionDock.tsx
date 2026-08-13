import React from 'react'
import { Download, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react'

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

    return (
        <div
            className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center justify-end sm:justify-center gap-2 sm:gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto ${className}`.trim()}
            role="toolbar"
            aria-label="Acciones del formulario"
        >
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

            {/* Boton Guardar (Secundario / Icono) */}
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

            {/* Boton Guardar y Exportar (Primario / Icono) */}
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
