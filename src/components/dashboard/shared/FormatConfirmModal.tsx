import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'

type FormatConfirmModalProps = {
    open: boolean
    formatLabel: string
    actionLabel: string
    title?: string
    description?: string
    onClose: () => void
    onConfirm: () => void
}

export default function FormatConfirmModal({ 
    open, 
    formatLabel, 
    actionLabel, 
    title = "Confirmar formato",
    description = "Se generará el registro con la siguiente denominación obligatoria antes de continuar.",
    onClose, 
    onConfirm 
}: FormatConfirmModalProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!open || !mounted) return null

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-md">
            <div className="relative w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Cerrar"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0089b3]/10 text-[#0089b3]">
                    <FileText className="h-8 w-8" />
                </div>

                <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        {description}
                    </p>
                </div>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Formato</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{formatLabel}</p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-2xl bg-[#0089b3] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#007499] shadow-[#0089b3]/25"
                    >
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
