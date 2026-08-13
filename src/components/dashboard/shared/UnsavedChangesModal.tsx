import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

export interface UnsavedChangesModalProps {
    open: boolean
    title?: string
    description?: string
    onClose: () => void // Seguir editando / Cancelar
    onDiscard: () => void // Salir sin guardar
    onSave?: () => void // Guardar y salir (opcional)
    isSaving?: boolean
}

export default function UnsavedChangesModal({
    open,
    title = "Cambios sin guardar",
    description = "¿Deseas salir del formulario? Tienes cambios que aún no han sido guardados en el servidor.",
    onClose,
    onDiscard,
    onSave,
    isSaving = false,
}: UnsavedChangesModalProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!open || !mounted) return null

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-md pointer-events-auto animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Cerrar"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 shadow-inner">
                    <AlertTriangle className="h-7 w-7" />
                </div>

                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        {description}
                    </p>
                </div>

                <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition shadow-xs"
                    >
                        Seguir editando
                    </button>
                    <button
                        type="button"
                        onClick={onDiscard}
                        className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold transition shadow-xs"
                    >
                        Salir sin guardar
                    </button>
                    {onSave && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar y salir'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
