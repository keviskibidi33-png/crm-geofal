"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ShieldAlert } from "lucide-react"

interface SessionTerminatedDialogProps {
    open: boolean
    onConfirm: () => void
}

export function SessionTerminatedDialog({ open, onConfirm }: SessionTerminatedDialogProps) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="z-[9999] max-w-[450px] border-none bg-white shadow-2xl p-0 overflow-hidden ring-1 ring-zinc-200">
                <div className="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100">
                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4 ring-4 ring-red-50">
                        <ShieldAlert className="h-8 w-8 text-red-600" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-bold text-red-900 text-center">
                        Sesión Terminada
                    </AlertDialogTitle>
                    <p className="text-red-700 font-medium mt-1">Acceso Remoto Revocado</p>
                </div>

                <div className="p-6 space-y-4">
                    <AlertDialogDescription className="text-zinc-600 text-center text-base leading-relaxed">
                        Su sesión ha sido cerrada por un administrador o por motivos de seguridad del sistema.
                        <br />
                        Para continuar trabajando, debe iniciar sesión nuevamente con sus credenciales.
                    </AlertDialogDescription>

                    <AlertDialogFooter className="mt-6 flex justify-center sm:justify-center">
                        <AlertDialogAction
                            onClick={onConfirm}
                            className="w-full bg-zinc-900 text-white hover:bg-zinc-800 font-semibold py-6 text-lg transition-all"
                        >
                            Volver al Login
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    )
}
