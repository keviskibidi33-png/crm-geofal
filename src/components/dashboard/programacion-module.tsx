"use client"

import { Button } from "@/components/ui/button"
import type { ModuleType, User } from "@/hooks/use-auth"
import { ArrowRight, Briefcase, Building2, FlaskConical, Info } from "lucide-react"

type ProgramacionTargetModule = Extract<ModuleType, "laboratorio" | "comercial" | "administracion">

interface ProgramacionModuleProps {
    user: User
    onNavigateModule?: (module: ProgramacionTargetModule) => void
}

const TARGET_MODULES: Array<{
    id: ProgramacionTargetModule
    title: string
    description: string
    icon: typeof FlaskConical
}> = [
    {
        id: "laboratorio",
        title: "Laboratorio",
        description: "Módulo independiente para la programación del laboratorio.",
        icon: FlaskConical,
    },
    {
        id: "comercial",
        title: "Comercial",
        description: "Módulo independiente para programación comercial.",
        icon: Briefcase,
    },
    {
        id: "administracion",
        title: "Administración",
        description: "Módulo independiente para programación administrativa.",
        icon: Building2,
    },
]

export function ProgramacionModule({ user, onNavigateModule }: ProgramacionModuleProps) {
    const roleLabel = user.roleLabel || user.role || "usuario"

    return (
        <div className="flex flex-col h-full p-6 bg-zinc-50/50 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-6">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-blue-100 p-2 text-blue-700">
                            <Info className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Programación migrada
                            </span>
                            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                                El módulo unificado fue desactivado
                            </h1>
                            <p className="text-sm text-zinc-600">
                                Hola {roleLabel}. Ahora cada vista de programación vive en su propio módulo independiente.
                                Ya no usamos pestañas internas aquí; abre directamente el módulo correspondiente desde el panel lateral.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {TARGET_MODULES.map((module) => {
                        const Icon = module.icon
                        const isEnabled = typeof onNavigateModule === "function"

                        return (
                            <div
                                key={module.id}
                                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col gap-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="rounded-xl bg-zinc-100 p-2 text-zinc-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-base font-semibold text-zinc-900">{module.title}</h2>
                                        <p className="text-sm text-zinc-500">{module.description}</p>
                                    </div>
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-3">
                                    <span className="text-xs uppercase tracking-wide text-zinc-400">
                                        módulo independiente
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => onNavigateModule?.(module.id)}
                                        disabled={!isEnabled}
                                    >
                                        Abrir
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                    Los iframes, el realtime y los permisos viven ahora en cada módulo independiente. Este hub queda
                    solo como transición temporal para no romper accesos antiguos.
                </div>
            </div>
        </div>
    )
}
