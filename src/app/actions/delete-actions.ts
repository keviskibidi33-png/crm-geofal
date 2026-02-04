"use server"

import { createClient } from "@supabase/supabase-js"

import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to verify admin role (Copied from auth-actions or should be shared)
async function verifyAdminRole(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const sessionId = cookieStore.get('crm_session')?.value
  if (!sessionId) return false

  const { data: sessionData } = await supabaseAdmin
    .from('active_sessions')
    .select('user_id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!sessionData) return false

  const { data: userProfile } = await supabaseAdmin
    .from('perfiles')
    .select('role')
    .eq('id', sessionData.user_id)
    .maybeSingle()

  return userProfile?.role?.toLowerCase() === 'admin'
}

export async function deleteClientAction(clientId: string) {
  if (!(await verifyAdminRole())) {
    return { error: "No tiene permisos para realizar esta acción." }
  }

  if (!supabaseServiceKey) {
    return { error: "Service Role Key not configured" }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { error } = await supabaseAdmin
      .from("clientes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('💥 [SERVER DELETE CLIENT ERROR]', error)
    return { error: error.message || "Failed to delete client" }
  }
}

export async function deleteProjectAction(projectId: string) {
  if (!(await verifyAdminRole())) {
    return { error: "No tiene permisos para realizar esta acción." }
  }

  if (!supabaseServiceKey) {
    return { error: "Service Role Key not configured" }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { error } = await supabaseAdmin
      .from("proyectos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", projectId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('💥 [SERVER DELETE PROJECT ERROR]', error)
    return { error: error.message || "Failed to delete project" }
  }
}
