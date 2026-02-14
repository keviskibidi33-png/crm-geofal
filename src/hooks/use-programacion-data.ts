import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"

// -----------------------------------------------------------------------
// Lightweight KPI data — the shell only needs counts + 3 recent changes.
// The full data table lives inside the iframe (programacion-crm).
// NO full cuadro_control fetch — eliminates the 111 kB refetch flicker.
// -----------------------------------------------------------------------

interface ProgramacionKpis {
    total: number
    pendientes: number
    proceso: number
    finalizados: number
    atrasados: number
}

const EMPTY_KPIS: ProgramacionKpis = { total: 0, pendientes: 0, proceso: 0, finalizados: 0, atrasados: 0 }

export function useProgramacionData() {
    const [kpis, setKpis] = useState<ProgramacionKpis>(EMPTY_KPIS)
    const [recentChanges, setRecentChanges] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // Fetch KPIs with lightweight count queries (no full data transfer)
    const fetchKpis = async () => {
        try {
            const [totalRes, pendRes, procRes, finRes] = await Promise.all([
                supabase.from("programacion_lab").select("id", { count: "exact", head: true }),
                supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PENDIENTE"),
                supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO"),
                supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("estado_trabajo.eq.COMPLETADO,estado_trabajo.eq.FINALIZADO"),
            ])

            const today = new Date().toISOString().split("T")[0]
            const atrasadosRes = await supabase
                .from("programacion_lab")
                .select("id", { count: "exact", head: true })
                .is("entrega_real", null)
                .not("fecha_entrega_estimada", "is", null)
                .lt("fecha_entrega_estimada", today)

            setKpis({
                total: totalRes.count ?? 0,
                pendientes: pendRes.count ?? 0,
                proceso: procRes.count ?? 0,
                finalizados: finRes.count ?? 0,
                atrasados: atrasadosRes.count ?? 0,
            })

            // Also fetch 3 most recent changes (lightweight — only 3 rows)
            const { data: recent } = await supabase
                .from("cuadro_control")
                .select("id,ot,proyecto,cliente_nombre,estado_trabajo,descripcion_servicio,updated_at")
                .not("updated_at", "is", null)
                .order("updated_at", { ascending: false })
                .limit(3)
            setRecentChanges(recent ?? [])
        } catch {
            console.error("Error fetching KPIs")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchKpis()

        // Realtime: only refresh counts (lightweight), debounced 3s
        let debounce: ReturnType<typeof setTimeout> | null = null

        const channel = supabase
            .channel("shell_kpi_realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "programacion_lab" }, () => {
                if (debounce) clearTimeout(debounce)
                debounce = setTimeout(fetchKpis, 3000)
            })
            .subscribe((status) => {
                setRealtimeStatus(status)
                if (status === "CHANNEL_ERROR") {
                    toast.error("Error de conexión en tiempo real")
                }
            })

        return () => {
            supabase.removeChannel(channel)
            if (debounce) clearTimeout(debounce)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        kpis,
        data: [] as any[],
        recentChanges,
        isLoading,
        realtimeStatus,
    }
}
