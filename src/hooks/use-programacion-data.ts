import { useEffect, useCallback, useState, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"
import { ProgramacionServicio } from "@/types/programacion"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

export function useProgramacionData() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // Track IDs we just changed locally so realtime can skip self-echoes
    const pendingLocalIds = useRef<Set<string>>(new Set())
    // Debounce timer for coalescing rapid realtime events
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 1. Fetch Inicial (Carga los 2000 registros una vez)
    const { data = [], isLoading } = useQuery({
        queryKey: ["programacion"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cuadro_control")
                .select("*")
                .order("item_numero", { ascending: false })

            if (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar datos")
                throw error
            }
            return data as ProgramacionServicio[]
        },
        staleTime: Infinity, // Don't auto-refetch, rely on Realtime
    })

    // 2. Debounced refetch — coalesces burst events into 1 call
    const debouncedRefetch = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }, 2000)
    }, [queryClient])

    // 3. Suscripción Realtime — merge in-place, no full refetch on UPDATE
    useEffect(() => {
        const handlePayload = (payload: any) => {
            const id = payload.new?.id || payload.new?.programacion_id
                || payload.old?.id || payload.old?.programacion_id

            // Skip events caused by our own writes
            if (id && pendingLocalIds.current.has(id)) {
                pendingLocalIds.current.delete(id)
                return
            }

            const eventType = payload.eventType

            if (eventType === "DELETE") {
                queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) =>
                    old.filter(r => r.id !== id)
                )
                return
            }

            if (eventType === "INSERT") {
                // New row from another user — debounced refetch (needs view join)
                debouncedRefetch()
                return
            }

            // UPDATE — merge changed fields into cache
            if (eventType === "UPDATE" && payload.new) {
                const changed = payload.new
                queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                    const matchId = changed.id || changed.programacion_id
                    const found = old.some(r => r.id === matchId)
                    if (!found) {
                        debouncedRefetch()
                        return old
                    }
                    return old.map(row => {
                        if (row.id !== matchId) return row
                        const merged = { ...row }
                        for (const key of Object.keys(changed)) {
                            if (key === "id" || key === "programacion_id") continue
                            ;(merged as any)[key] = changed[key]
                        }
                        return merged
                    })
                })
            }
        }

        const channel = supabase
            .channel("shell_programacion_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_lab" },
                handlePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_comercial" },
                handlePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_administracion" },
                handlePayload
            )
            .subscribe((status) => {
                setRealtimeStatus(status)
                if (status === "CHANNEL_ERROR") {
                    toast.error("Error de conexión en tiempo real")
                }
            })

        return () => {
            supabase.removeChannel(channel)
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
        }
    }, [queryClient, debouncedRefetch])

    // Hybrid Update Logic (Compatible with DataTable)
    const updateField = useCallback(async (rowId: string, field: string, value: unknown) => {
        if (user?.role === 'laboratorio_lector') {
            toast.error("No tienes permisos para modificar datos. Tu rol es de solo lectura.")
            return
        }
        // 1. Optimistic Update in Cache (instant UI)
        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
            return oldData.map(row => row.id === rowId ? { ...row, [field]: value } : row)
        })

        // 2. Mark so realtime skips our own echo
        pendingLocalIds.current.add(rowId)

        try {
            const commercialFields = ['fecha_solicitud_com', 'fecha_entrega_com', 'evidencia_solicitud_envio', 'dias_atraso_envio_coti', 'motivo_dias_atraso_com']
            const adminFields = ['numero_factura', 'estado_pago', 'estado_autorizar', 'nota_admin']

            let targetTable = "programacion_lab"
            let idField = "id"

            if (commercialFields.includes(field)) {
                targetTable = "programacion_comercial"
                idField = "programacion_id"
            } else if (adminFields.includes(field)) {
                targetTable = "programacion_administracion"
                idField = "programacion_id"
            }

            const { error } = await supabase
                .from(targetTable)
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq(idField, rowId)

            if (error) throw error
        } catch (error) {
            console.error("Update failed:", error)
            toast.error("Error al guardar")
            pendingLocalIds.current.delete(rowId)
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    const insertRow = useCallback(async (newRow: Partial<ProgramacionServicio>) => {
        if (user?.role === 'laboratorio_lector') {
            toast.error("No tienes permisos para crear registros. Tu rol es de solo lectura.")
            return
        }
        const { data: insertedData, error: labError } = await supabase
            .from("programacion_lab")
            .insert({
                ...newRow,
                item_numero: undefined,
                created_at: new Date().toISOString(),
                estado_trabajo: newRow.estado_trabajo || "PENDIENTE",
                evidencia_envio_recepcion: newRow.evidencia_envio_recepcion,
                envio_informes: newRow.envio_informes,
                // Extension fields handled via follow-up update
                fecha_solicitud_com: undefined,
                fecha_entrega_com: undefined,
                evidencia_solicitud_envio: undefined,
                motivo_dias_atraso_com: undefined,
                numero_factura: undefined,
                estado_pago: undefined,
                estado_autorizar: undefined,
                nota_admin: undefined,
            })
            .select()
            .single()

        if (insertedData) {
            pendingLocalIds.current.add(insertedData.id)
        }

        if (labError) {
            console.error("Insert lab failed:", labError)
            toast.error("Error al crear registro")
            throw labError
        }

        if (insertedData) {
            const rowId = insertedData.id

            // Check if we need to update extension tables
            const commercialData: any = {}
            if (newRow.fecha_solicitud_com) commercialData.fecha_solicitud_com = newRow.fecha_solicitud_com
            if (newRow.fecha_entrega_com) commercialData.fecha_entrega_com = newRow.fecha_entrega_com
            if (newRow.evidencia_solicitud_envio) commercialData.evidencia_solicitud_envio = newRow.evidencia_solicitud_envio
            if (newRow.motivo_dias_atraso_com) commercialData.motivo_dias_atraso_com = newRow.motivo_dias_atraso_com

            const adminData: any = {}
            if (newRow.numero_factura) adminData.numero_factura = newRow.numero_factura
            if (newRow.estado_pago) adminData.estado_pago = newRow.estado_pago
            if (newRow.estado_autorizar) adminData.estado_autorizar = newRow.estado_autorizar
            if (newRow.nota_admin) adminData.nota_admin = newRow.nota_admin

            if (Object.keys(commercialData).length > 0) {
                await supabase.from("programacion_comercial").update(commercialData).eq("programacion_id", rowId)
            }
            if (Object.keys(adminData).length > 0) {
                await supabase.from("programacion_administracion").update(adminData).eq("programacion_id", rowId)
            }

            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    return {
        data,
        isLoading,
        realtimeStatus,
        refetch: async () => { await queryClient.invalidateQueries({ queryKey: ["programacion"] }) },
        updateField,
        insertRow
    }
}
