"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

export type ElementoValue = "-" | "PEQUEÑA" | "GRANDE" | "DIAMANTINA" | "CUBO" | "VIGA"
export type StatusEnsayoValue = "-" | "ENSAYADO" | "PENDIENTE" | "FALTA" | "ANULADO"
export type StatusEntregaValue = "-" | "ENTREGADO" | "INFORME LISTO" | "ROTAS" | "ANULADAS"

export interface ProbetaRow {
  muestra_id: number
  item_numero: number
  recepcion_id: number
  numero_recepcion: string
  numero_ot: string
  cliente: string
  proyecto?: string
  fecha_recepcion?: string
  edad?: number
  codigo_muestra_lem?: string
  identificacion_muestra?: string
  estructura?: string
  elemento?: string
  fosa?: string
  fecha_rotura?: string
  /** "SI" or "NO" derived from requiere_densidad */
  densidad?: string
  requiere_densidad?: boolean
  fc_kg_cm2: number
  status_ensayo?: string
  status_entrega?: string
  fecha_entrega?: string
  estado_probeta: string
  fecha_moldeo?: string
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

export const ELEMENTOS: ElementoValue[] = ["-", "PEQUEÑA", "GRANDE", "DIAMANTINA", "CUBO", "VIGA"]
export const FOSAS = ["-", "FOSA 1", "FOSA 2", "FOSA 3", "FOSA 4", "FOSA 5", "FOSA 6", "ROTAS"] as const
export const STATUS_ENSAYO: StatusEnsayoValue[] = ["-", "ENSAYADO", "PENDIENTE", "FALTA", "ANULADO"]
export const STATUS_ENTREGA: StatusEntregaValue[] = ["-", "ENTREGADO", "INFORME LISTO", "ROTAS", "ANULADAS"]

export function formatDateDisplay(v?: string | null): string {
  if (!v || v === "-") return ""
  const clean = v.split("T")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (a.length === 4) return `${c.padStart(2, "0")}/${b.padStart(2, "0")}/${a}`
    if (c.length === 4) return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/${c}`
    if (a.length === 2 && c.length === 2) return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/20${c}`
  }
  return v
}

export function parseDateInput(v: string): string {
  const raw = v.trim()
  if (!raw || raw === "-") return ""
  const clean = raw.replace(/[\/\-\.]/g, "/")
  const parts = clean.split("/").filter(Boolean)

  if (parts.length === 3) {
    const [p1, p2, p3] = parts
    if (p1.length === 4) {
      const y = p1, m = p2.padStart(2, "0"), d = p3.padStart(2, "0")
      return `${y}/${m}/${d}`
    }
    if (p3.length === 4) {
      const d = p1.padStart(2, "0"), m = p2.padStart(2, "0"), y = p3
      return `${y}/${m}/${d}`
    }
    if (p1.length === 2 && p3.length === 2) {
      const d = p1.padStart(2, "0"), m = p2.padStart(2, "0"), y = `20${p3}`
      return `${y}/${m}/${d}`
    }
  }

  if (parts.length === 2) {
    const [p1, p2] = parts
    if (p1.length <= 2 && p2.length <= 2) {
      const d = p1.padStart(2, "0"), m = p2.padStart(2, "0")
      const y = new Date().getFullYear()
      return `${y}/${m}/${d}`
    }
    if (p1.length === 4) {
      return `${p1}/${p2.padStart(2, "0")}/01`
    }
    if (p2.length === 4) {
      return `${p2}/${p1.padStart(2, "0")}/01`
    }
  }

  const digits = raw.replace(/\D/g, "")
  if (digits.length === 4) {
    const dd = digits.slice(0, 2), mm = digits.slice(2, 4)
    const yyyy = new Date().getFullYear()
    return `${yyyy}/${mm}/${dd}`
  }
  if (digits.length === 6) {
    const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yy = digits.slice(4, 6)
    return `20${yy}/${mm}/${dd}`
  }
  if (digits.length === 8) {
    const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4, 8)
    if (Number(yyyy) > 1900) return `${yyyy}/${mm}/${dd}`
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
  const PAGE_SIZE_STORAGE_KEY = "control-probetas-page-size"
  const getInitialPageSize = () => {
    if (typeof window === "undefined") return 25
    const raw = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
    return [100, 1000, 2000, 4000].includes(raw) ? raw : 100
  }
  const [pageSize, setPageSizeState] = useState<number>(100)
  const [search, setSearch] = useState("")
  const debouncedSearch = useRef("")

  useEffect(() => {
    setPageSizeState(getInitialPageSize())
  }, [])

  const setPageSize = useCallback((next: number) => {
    const normalized = [100, 1000, 2000, 4000].includes(next) ? next : 100
    setPageSizeState(normalized)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(normalized))
    }
  }, [])

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
      const res = await authFetch(`${API_URL}/api/control-probetas/importar-recepcion/${recepcionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
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
