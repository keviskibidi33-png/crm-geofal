"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2, Lock, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { authFetch } from "@/lib/api-auth"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/use-auth"

type Reserva = {
  id: number
  numero: number
  user_id: string
  user_name?: string | null
  fecha: string
  documento_referencia: string
  proposito?: string | null
}

type Celda = {
  numero: number
  estado: "libre" | "ocupado"
  reserva: Reserva | null
}

type Participante = {
  user_id: string
  user_name?: string | null
  estado: "active" | "waiting"
  desde: string
}

type Turno = {
  user_id: string
  estado: "active" | "waiting" | "sin_turno"
  tiene_turno: boolean
  turno_activo_user_id: string | null
  turno_activo_user_name?: string | null
  turno_activo_desde: string | null
  en_cola: number
  personas_esperando: number
  participantes: Participante[]
  mensaje: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function CorrelativosModule() {
  const { user } = useAuth()
  const [inicio, setInicio] = useState(1)
  const [fin, setFin] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [celdas, setCeldas] = useState<Celda[]>([])
  const [turno, setTurno] = useState<Turno | null>(null)
  const [selectedNumeros, setSelectedNumeros] = useState<number[]>([])
  const [archivo, setArchivo] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCelda, setModalCelda] = useState<Celda | null>(null)
  const waitingCountRef = useRef(0)

  const total = useMemo(() => Math.max(0, fin - inicio + 1), [inicio, fin])
  const canReserve = turno?.estado === "active" && turno?.tiene_turno

  const apiCall = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (user?.id) headers.set("x-dev-user-id", user.id)
      return authFetch(url, { ...init, headers })
    },
    [user?.id],
  )

  const fetchTablero = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiCall(`${API_URL}/api/correlativos/tablero?inicio=${inicio}&fin=${fin}`)
      if (!response.ok) throw new Error("No se pudo cargar tablero")
      const data = await response.json()
      setCeldas(Array.isArray(data?.celdas) ? data.celdas : [])
    } catch {
      toast.error("No se pudo cargar el tablero de correlativos")
    } finally {
      setLoading(false)
    }
  }, [apiCall, inicio, fin])

  const fetchTurnoEstado = useCallback(async (heartbeat = false) => {
    try {
      const endpoint = heartbeat ? "/api/correlativos/turno/heartbeat" : "/api/correlativos/turno/estado"
      const response = await apiCall(`${API_URL}${endpoint}`, { method: heartbeat ? "POST" : "GET" })
      if (!response.ok) throw new Error("No se pudo obtener turno")
      const data = await response.json()
      setTurno(data)

      if (data?.estado === "active" && Number(data?.personas_esperando || 0) > waitingCountRef.current) {
        toast.info("Hay usuarios esperando", {
          description: `${data.personas_esperando} usuario(s) están en cola para reservar.`,
        })
      }
      waitingCountRef.current = Number(data?.personas_esperando || 0)
    } catch {
      // silent
    }
  }, [apiCall])

  const entrarTurno = useCallback(async () => {
    try {
      const response = await apiCall(`${API_URL}/api/correlativos/turno/entrar`, { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.detail || data?.message || "No se pudo ingresar")

      setTurno(data)
      toast.success(data?.estado === "active" ? "Turno activo" : "Entraste a la cola")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ingresar al turno")
    }
  }, [apiCall])

  const salirTurno = useCallback(async () => {
    try {
      const response = await apiCall(`${API_URL}/api/correlativos/turno/salir`, { method: "POST" })
      if (!response.ok) throw new Error("No se pudo salir")
      const data = await response.json()
      setTurno(data)
      setSelectedNumeros([])
      toast.success("Saliste de la cola")
    } catch {
      toast.error("No se pudo salir del turno")
    }
  }, [apiCall])

  useEffect(() => {
    void fetchTablero()
    void fetchTurnoEstado(false)
  }, [fetchTablero, fetchTurnoEstado])

  useEffect(() => {
    const interval = setInterval(() => {
      const mustHeartbeat = turno?.estado === "active" || turno?.estado === "waiting"
      void fetchTurnoEstado(Boolean(mustHeartbeat))
      if (turno?.estado === "active") void fetchTablero()
    }, 3000)
    return () => clearInterval(interval)
  }, [turno?.estado, fetchTablero, fetchTurnoEstado])

  useEffect(() => {
    const channel = supabase
      .channel("correlativos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "correlativos_turnos" }, () => void fetchTurnoEstado(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "correlativos_reserva" }, () => void fetchTablero())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTablero, fetchTurnoEstado])

  const openCellModal = (celda: Celda) => {
    setModalCelda(celda)
    setModalOpen(true)
  }

  const toggleSelect = (numero: number) => {
    setSelectedNumeros((prev) =>
      prev.includes(numero) ? prev.filter((n) => n !== numero) : [...prev, numero].sort((a, b) => a - b),
    )
  }

  const handleMarcarLote = async () => {
    if (!selectedNumeros.length) {
      toast.warning("Selecciona uno o más cuadros")
      return
    }
    if (!archivo.trim()) {
      toast.warning("Debes ingresar el archivo/documento")
      return
    }

    setSaving(true)
    try {
      const response = await apiCall(`${API_URL}/api/correlativos/reservar-lote`, {
        method: "POST",
        body: JSON.stringify({
          numeros: selectedNumeros,
          documento_referencia: archivo.trim(),
          proposito: null,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (Array.isArray(data?.ocupados) && data.ocupados.length) {
          throw new Error(`Ocupados: ${data.ocupados.join(", ")}`)
        }
        throw new Error(data?.detail || data?.message || "No se pudo marcar")
      }

      toast.success(`✅ Marcados ${data?.reservas?.length || selectedNumeros.length} correlativos`, {
        description: `Archivo: ${archivo.trim()}. Turno finalizado.`,
      })
      setSelectedNumeros([])
      setArchivo("")
      await fetchTablero()
      await fetchTurnoEstado(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar")
    } finally {
      setSaving(false)
    }
  }

  const activeDisplayName = turno?.turno_activo_user_name || turno?.turno_activo_user_id

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Tablero de Correlativos
            <Badge variant={canReserve ? "default" : "secondary"}>
              {canReserve ? "Turno activo" : turno?.estado === "waiting" ? `En cola #${turno?.en_cola || "-"}` : "Sin turno"}
            </Badge>
            {activeDisplayName && (
              <Badge variant="outline" className="text-sky-700 border-sky-400">
                Turno actual: {activeDisplayName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Flujo: entra al turno → abre el cuadro para ver detalle → selecciona uno o varios cuadros libres → ingresa el archivo/documento → marca para finalizar.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" value={inicio} onChange={(e) => setInicio(Math.max(1, Number(e.target.value || 1)))} className="w-28" />
            <Input type="number" value={fin} onChange={(e) => setFin(Math.max(inicio, Number(e.target.value || inicio)))} className="w-28" />
            <Button variant="outline" onClick={() => void fetchTablero()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            {!canReserve && turno?.estado !== "waiting" && <Button onClick={() => void entrarTurno()}>Entrar al turno</Button>}
            {turno?.estado === "waiting" && <Button variant="outline" onClick={() => void salirTurno()}>Salir de cola</Button>}
          </div>

          <div className="rounded-md border bg-muted/20 p-2">
            <div className="flex items-center gap-2 text-xs font-medium mb-1"><Users className="h-3.5 w-3.5" /> En sistema ({turno?.participantes?.length || 0})</div>
            <div className="flex flex-wrap gap-2">
              {(turno?.participantes || []).map((p) => (
                <Badge key={`${p.user_id}-${p.estado}`} variant={p.estado === "active" ? "default" : "secondary"}>
                  {p.user_name || p.user_id} {p.estado === "active" ? "(tomando turno)" : "(cola)"}
                </Badge>
              ))}
              {!turno?.participantes?.length && <span className="text-xs text-muted-foreground">Sin usuarios en turno.</span>}
            </div>
          </div>

          {canReserve && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
              <div className="text-sm font-semibold">Seleccionados: {selectedNumeros.length ? selectedNumeros.join(", ") : "ninguno"}</div>
              <Input
                placeholder="Archivo / Documento (ej: Documento01)"
                value={archivo}
                onChange={(event) => setArchivo(event.target.value)}
                autoComplete="off"
                data-lpignore="true"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Responsable: <span className="font-medium text-foreground">{user?.name || user?.id || "Sistema"}</span></div>
                <div>Fecha: <span className="font-medium text-foreground">{new Date().toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void handleMarcarLote()} disabled={saving || !selectedNumeros.length} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Marcar y finalizar turno
                </Button>
                {selectedNumeros.length > 0 && (
                  <Button variant="outline" onClick={() => setSelectedNumeros([])}>Limpiar selección</Button>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Rango actual: {inicio} - {fin} ({total} celdas). Click abre detalle en modal. Verde = libre, Rojo = ocupado.
          </p>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2">
            {celdas.map((celda) => {
              const ocupado = celda.estado === "ocupado"
              const selected = selectedNumeros.includes(celda.numero)
              return (
                <button
                  type="button"
                  key={celda.numero}
                  onClick={() => openCellModal(celda)}
                  className={`min-h-[82px] rounded-md border p-2 text-left transition ${
                    ocupado
                      ? "border-red-300 bg-red-50 text-red-700"
                      : selected
                        ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <div className="text-sm font-bold">#{celda.numero}</div>
                  {ocupado ? (
                    <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
                      <div className="truncate">{celda.reserva?.documento_referencia || "-"}</div>
                      <div className="truncate">{celda.reserva?.user_name || celda.reserva?.user_id || "-"}</div>
                      <div>{celda.reserva?.fecha ? new Date(celda.reserva.fecha).toLocaleDateString() : "-"}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] opacity-80">{selected ? "Seleccionado" : "Disponible"}</div>
                  )}
                </button>
              )
            })}
          </div>

          {!canReserve && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
              <Lock className="h-4 w-4 mt-0.5" />
              <div>{turno?.mensaje || "Debes entrar al turno para elegir cuadros y marcar."}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle cuadro #{modalCelda?.numero}</DialogTitle>
            <DialogDescription>
              {modalCelda?.estado === "ocupado" ? "Información de reserva" : "Cuadro disponible para selección"}
            </DialogDescription>
          </DialogHeader>

          {modalCelda?.estado === "ocupado" ? (
            <div className="space-y-2 text-sm">
              <div><strong>Archivo:</strong> {modalCelda.reserva?.documento_referencia || "-"}</div>
              <div><strong>Responsable:</strong> {modalCelda.reserva?.user_name || modalCelda.reserva?.user_id || "-"}</div>
              <div><strong>Fecha:</strong> {modalCelda.reserva?.fecha ? new Date(modalCelda.reserva.fecha).toLocaleString() : "-"}</div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>Este cuadro está libre.</div>
              <div>Estado en tu lote: <strong>{selectedNumeros.includes(modalCelda?.numero || -1) ? "Seleccionado" : "No seleccionado"}</strong></div>
            </div>
          )}

          <DialogFooter>
            {modalCelda?.estado === "libre" && canReserve && (
              <Button
                onClick={() => {
                  if (modalCelda) toggleSelect(modalCelda.numero)
                }}
                variant={modalCelda && selectedNumeros.includes(modalCelda.numero) ? "destructive" : "default"}
              >
                {modalCelda && selectedNumeros.includes(modalCelda.numero) ? "Quitar de selección" : "Agregar a selección"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
