import { FileText, X } from 'lucide-react'

type FormatConfirmModalProps = {
    open: boolean
    formatLabel: string
    actionLabel: string
    onClose: () => void
    onConfirm: () => void
}

export default function FormatConfirmModal({ open, formatLabel, actionLabel, onClose, onConfirm }: FormatConfirmModalProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-md">
            <div className="relative w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Cerrar"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                    <FileText className="h-8 w-8" />
                </div>

                <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-900">Confirmar formato</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Se generará el registro con la siguiente denominación obligatoria antes de continuar.
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
                        className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700"
                    >
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
