"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

export type ElementoValue = "-" | "PEQUEÑA" | "GRANDE" | "DIAMANTINA" | "CUBO Y VIGA"
export type StatusEnsayoValue = "-" | "ENSAYADO" | "PENDIENTE" | "FALTA" | "ANULADO"
export type StatusEntregaValue = "-" | "ENTREGADO" | "INFORME LISTO"

export interface ProbetaRow {
  muestra_id: number
  item_numero: number
  recepcion_id: number
  numero_recepcion: string
  numero_ot: string
  cliente: string
  identificacion_muestra?: string
  elemento?: string
  fecha_rotura?: string
  densidad?: string
  fc_kg_cm2: number
  status_ensayo?: string
  status_entrega?: string
  fecha_entrega?: string
  estado_probeta: string
  fecha_moldeo?: string
  edad?: number
}

export interface Receipt {
  id: number
  numero_recepcion: string
  numero_ot?: string
  cliente?: string
  proyecto?: string
}

export interface ProbetasKpis {
  total: number
  curado: number
  pendiente: number
  ensayado: number
  vencido: number
}

export const ELEMENTOS: ElementoValue[] = ["-", "PEQUEÑA", "GRANDE", "DIAMANTINA", "CUBO Y VIGA"]
export const STATUS_ENSAYO: StatusEnsayoValue[] = ["-", "ENSAYADO", "PENDIENTE", "FALTA", "ANULADO"]
export const STATUS_ENTREGA: StatusEntregaValue[] = ["-", "ENTREGADO", "INFORME LISTO"]

export function formatDateDisplay(v?: string | null): string {
  if (!v || v === "-") return ""
  const clean = v.split("T")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`
  }
  return v
}

export function parseDateInput(v: string): string {
  const p = v.trim().split(/[\/\-]/).filter(Boolean)
  if (p.length === 3) {
    const year = p[2].length === 2 ? `20${p[2]}` : p[2]
    return `${year}/${p[1].padStart(2, "0")}/${p[0].padStart(2, "0")}`
  }
  return ""
}

export function useControlProbetas() {
  const [items, setItems] = useState<ProbetaRow[]>([])
  const [recentItems, setRecentItems] = useState<ProbetaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [kpis, setKpis] = useState<ProbetasKpis>({ total: 0, curado: 0, pendiente: 0, ensayado: 0, vencido: 0 })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState("")
  const debouncedSearch = useRef("")

  useEffect(() => {
    const t = setTimeout(() => {
      debouncedSearch.current = search.trim()
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (debouncedSearch.current) params.set("search", debouncedSearch.current)
      const res = await authFetch(`${API_URL}/api/control-probetas/?${params}`)
      if (!res.ok) throw new Error("No se pudo cargar")
      const data = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch (e: any) {
      toast.error(e?.message || "Error cargando probetas")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  const fetchKpis = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/kpis`)
      if (res.ok) {
        const data = await res.json()
        setKpis(data)
      }
    } catch {
      // KPIs are non-critical
    }
  }, [])

  const fetchRecentItems = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/?page=1&page_size=5`)
      if (res.ok) {
        const data = await res.json()
        setRecentItems(data.items || [])
      }
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    void fetchKpis()
  }, [fetchKpis])

  useEffect(() => {
    void fetchRecentItems()
  }, [fetchRecentItems])

  const updateRow = useCallback(async (id: number, payload: Record<string, unknown>) => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "Error al actualizar")
      const updated = await res.json()
      setItems(prev => prev.map(x => x.muestra_id === id ? updated : x))
      void fetchKpis()
    } catch (e: any) {
      toast.error(e?.message || "Error")
      void fetchItems()
    }
  }, [fetchKpis, fetchItems])

  const createRow = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "Error al crear")
      toast.success("Probeta registrada")
      void fetchItems()
      void fetchKpis()
    } catch (e: any) {
      toast.error(e?.message || "Error")
    }
  }, [fetchItems, fetchKpis])

  const searchRecepciones = useCallback(async (query: string): Promise<Receipt[]> => {
    if (!query.trim()) return []
    try {
      const res = await authFetch(`${API_URL}/api/recepcion/paginated?q=${encodeURIComponent(query)}&page_size=8`)
      if (res.ok) {
        const data = await res.json()
        return data.items || []
      }
    } catch { /* noop */ }
    return []
  }, [])

  const fetchByRecepcion = useCallback(async (recepcionId: number): Promise<ProbetaRow[]> => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/by-recepcion/${recepcionId}`)
      if (res.ok) {
        return await res.json()
      }
    } catch { /* noop */ }
    return []
  }, [])

  return {
    items, recentItems, loading, kpis, total, totalPages, page, pageSize, search,
    setPage, setPageSize, setSearch,
    fetchItems, fetchKpis, fetchRecentItems, updateRow, createRow, searchRecepciones, fetchByRecepcion,
  }
}
