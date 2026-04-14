import { useState, useCallback, useRef } from "react"
import { authFetch } from "@/lib/api-auth"

export interface Muestra {
    id: number
    item_numero: number
    codigo_muestra?: string
    codigo_muestra_lem?: string
    identificacion_muestra?: string
    estructura?: string
    fc_kg_cm2?: number
    fecha_moldeo?: string
    hora_moldeo?: string
    edad?: number
    fecha_rotura?: string
    requiere_densidad?: boolean
    [key: string]: any
}

export interface Recepcion {
    id: number
    numero_ot: string
    numero_recepcion: string
    numero_cotizacion?: string

    // Project Info
    cliente?: string
    domicilio_legal?: string
    ruc?: string
    persona_contacto?: string
    email?: string
    telefono?: string

    // Requester Info
    solicitante?: string
    domicilio_solicitante?: string
    proyecto?: string
    ubicacion?: string

    // Dates
    fecha_recepcion?: string
    fecha_estimada_culminacion?: string

    // Report Config
    emision_fisica?: boolean
    emision_digital?: boolean

    // People
    entregado_por?: string
    recibido_por?: string

    muestras: Muestra[] | any
    estado?: string
    created_at?: string
    muestras_count?: number
}

export interface RecepcionesPaginationState {
    page: number
    pageSize: number
    total: number
    totalPages: number
}

export interface FetchRecepcionesParams {
    page?: number
    pageSize?: number
    search?: string
}

const DEFAULT_PAGE_SIZE = 25

function normalizeMuestras(rawMuestras: unknown): Muestra[] {
    let parsedMuestras = rawMuestras
    if (typeof rawMuestras === "string") {
        try {
            parsedMuestras = JSON.parse(rawMuestras)
        } catch {
            parsedMuestras = []
        }
    }

    if (!Array.isArray(parsedMuestras)) {
        return []
    }

    const getSortableNumber = (value: unknown, fallback: number) => {
        const parsedValue = Number(value)
        return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
    }

    return [...parsedMuestras].sort((left, right) => {
        const leftItem = getSortableNumber(left?.item_numero, Number.MAX_SAFE_INTEGER)
        const rightItem = getSortableNumber(right?.item_numero, Number.MAX_SAFE_INTEGER)

        if (leftItem !== rightItem) {
            return leftItem - rightItem
        }

        return getSortableNumber(left?.id, 0) - getSortableNumber(right?.id, 0)
    })
}

export function useRecepciones() {
    const [recepciones, setRecepciones] = useState<Recepcion[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pagination, setPagination] = useState<RecepcionesPaginationState>({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 1,
    })
    const lastQueryRef = useRef<Required<FetchRecepcionesParams>>({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        search: "",
    })

    // Unified Backend URL
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

    const fetchRecepciones = useCallback(async (params: FetchRecepcionesParams = {}) => {
        const nextQuery: Required<FetchRecepcionesParams> = {
            page: Math.max(1, Number(params.page ?? lastQueryRef.current.page ?? 1)),
            pageSize: Math.max(1, Math.min(100, Number(params.pageSize ?? lastQueryRef.current.pageSize ?? DEFAULT_PAGE_SIZE))),
            search: String(params.search ?? lastQueryRef.current.search ?? "").trim(),
        }
        lastQueryRef.current = nextQuery

        setLoading(true)
        setError(null)
        try {
            const url = new URL(`${API_URL}/api/recepcion/paginated`)
            url.searchParams.set("page", String(nextQuery.page))
            url.searchParams.set("page_size", String(nextQuery.pageSize))
            if (nextQuery.search) {
                url.searchParams.set("q", nextQuery.search)
            }

            const res = await authFetch(url.toString(), {
                method: "GET",
            })

            if (!res.ok) throw new Error("Error fetching recepciones")
            const data = await res.json()

            const items = Array.isArray(data?.items) ? data.items : []
            const parsedData = items.map((r: any) => ({
                ...r,
                muestras_count: Number(r?.muestras_count ?? 0),
                muestras: [],
            }))

            setRecepciones(parsedData)
            const nextPagination: RecepcionesPaginationState = {
                page: Math.max(1, Number(data?.page ?? nextQuery.page)),
                pageSize: Math.max(1, Number(data?.page_size ?? nextQuery.pageSize)),
                total: Math.max(0, Number(data?.total ?? 0)),
                totalPages: Math.max(1, Number(data?.total_pages ?? 1)),
            }
            setPagination(nextPagination)
            lastQueryRef.current = {
                page: nextPagination.page,
                pageSize: nextPagination.pageSize,
                search: nextQuery.search,
            }
        } catch (err: any) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [API_URL])

    const refreshRecepciones = useCallback(async () => {
        await fetchRecepciones(lastQueryRef.current)
    }, [fetchRecepciones])

    const getRecepcionById = useCallback(async (id: number): Promise<Recepcion> => {
        const res = await authFetch(`${API_URL}/api/recepcion/${id}`, {
            method: "GET",
        })
        if (!res.ok) throw new Error("Error fetching recepción detail")
        const data = await res.json()
        return {
            ...data,
            muestras: normalizeMuestras(data?.muestras),
        }
    }, [API_URL])

    const deleteRecepcion = useCallback(async (id: number) => {
        try {
            const res = await authFetch(`${API_URL}/api/recepcion/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error("Failed to delete")
            return true
        } catch (e: any) {
            setError(e.message)
            return false
        }
    }, [API_URL])

    return {
        recepciones,
        loading,
        error,
        pagination,
        fetchRecepciones,
        refreshRecepciones,
        getRecepcionById,
        deleteRecepcion
    }
}
