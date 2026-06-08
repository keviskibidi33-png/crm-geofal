import { useMemo } from 'react'
export interface TamanoMasaEntry {
    tm: string
    masa_g: number
}

/** Tabla ASTM D2216 — Tamaño máximo vs masa mínima recomendada */
const TABLA_TM: TamanoMasaEntry[] = [
    { tm: "3",     masa_g: 5000 },
    { tm: "2 1/2", masa_g: 5000 },
    { tm: "2",     masa_g: 5000 },
    { tm: "1 1/2", masa_g: 1000 },
    { tm: "1",     masa_g: 1000 },
    { tm: "3/4",   masa_g: 250  },
    { tm: "1/2",   masa_g: 250  },
    { tm: "3/8",   masa_g: 500  },
    { tm: "N°4",   masa_g: 100  },
    { tm: "N°10",  masa_g: 20   },
]

interface Props {
    /** Callback cuando se selecciona un TM — pasa el TM y la masa mínima */
    onSelect?: (tm: string, masaMinima: number) => void
    /** Masa actual de la muestra para validar "Cumple" / "No Cumple" */
    masaMuestra?: number
    /** Valor seleccionado de TM controlado por el formulario */
    selectedTM?: string
}

export default function TMCalculator({ onSelect, masaMuestra, selectedTM = "" }: Props) {
    const normalizeTM = (value: string): string => (
        value
            .toUpperCase()
            .replace(/\s+IN\.?$/i, "")
            .replace(/\s+/g, " ")
            .trim()
    )

    const resolvedTM = useMemo(() => {
        if (!selectedTM) return ""
        const normalizedSelected = normalizeTM(selectedTM)
        const match = TABLA_TM.find((entry) => normalizeTM(entry.tm) === normalizedSelected)
        return match?.tm ?? ""
    }, [selectedTM])

    const masaMinima = useMemo(() => {
        const entry = TABLA_TM.find(e => e.tm === resolvedTM)
        return entry?.masa_g ?? null
    }, [resolvedTM])

    const cumple = useMemo(() => {
        if (masaMinima === null || masaMuestra === null || masaMuestra === undefined || Number.isNaN(masaMuestra)) return null
        return masaMuestra >= masaMinima
    }, [masaMinima, masaMuestra])

    const handleChange = (tm: string) => {
        const entry = TABLA_TM.find(e => e.tm === tm)
        if (entry && onSelect) {
            onSelect(tm, entry.masa_g)
        }
    }

    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-muted/50 rounded-t-lg">
                <h3 className="text-sm font-semibold text-foreground">
                    Calculadora de Masa Mínima — ASTM D2216
                </h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Tamaño máximo selector + resultado */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Tamaño máximo TM:
                        </label>
                        <select
                            value={resolvedTM}
                            onChange={e => handleChange(e.target.value)}
                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm
                                       focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Seleccionar...</option>
                            {TABLA_TM.map(entry => (
                                <option key={entry.tm} value={entry.tm}>
                                    {entry.tm}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Cantidad mínima:
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-9 px-3 rounded-md border border-input bg-muted/30
                                           flex items-center text-sm font-medium">
                                {masaMinima !== null ? `${masaMinima} g` : "—"}
                            </div>
                            {cumple !== null && (
                                <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                                    cumple
                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                        : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                    {cumple ? 'Cumple' : 'No Cumple'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabla de referencia */}
                <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/60">
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-r border-border">
                                    TM (in.)
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                    MASA MÍNIMA (g)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {TABLA_TM.map((entry, i) => (
                                <tr
                                    key={entry.tm}
                                    className={`border-t border-border cursor-pointer transition-colors
                                        ${entry.tm === resolvedTM
                                            ? 'bg-primary/10 font-semibold'
                                            : i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                                        }
                                        hover:bg-primary/5`}
                                    onClick={() => handleChange(entry.tm)}
                                >
                                    <td className="px-3 py-1.5 border-r border-border">{entry.tm}</td>
                                    <td className="px-3 py-1.5">{entry.masa_g.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
