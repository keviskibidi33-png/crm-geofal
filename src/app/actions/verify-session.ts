"use server"

import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function verifySessionConsistencyAction(clientUserId: string) {
    if (!supabaseServiceKey) return { error: "Falta Service Role Key" }

    try {
        const cookieStore = await cookies()
        const sessionId = cookieStore.get('crm_session')?.value

        if (!sessionId) {
            return { error: "No hay cookie de sesión activa", isValid: false }
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // Check if the cookie session belongs to the SAME user as the client
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('active_sessions')
            .select('user_id')
            .eq('session_id', sessionId)
            .single()

        if (sessionError || !sessionData) {
            return { error: "Sesión de servidor inválida o no encontrada", isValid: false }
        }

        if (sessionData.user_id !== clientUserId) {
            console.warn(`[SessionConsistency] MISMATCH: Server session user (${sessionData.user_id}) !== Client user (${clientUserId})`)
            return {
                error: `Conflicto de sesión: Estás usando una sesión de otro usuario (${sessionData.user_id}). Se cerrará la sesión.`,
                isValid: false,
                mismatch: true
            }
        }

        return { success: true, isValid: true }

    } catch (err: any) {
        console.error("Session consistency check error:", err)
        return { error: "Error interno al verificar sesión", isValid: false }
    }
}
