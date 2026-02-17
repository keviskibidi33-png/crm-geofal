"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { deleteSessionAction } from "@/app/actions/auth-actions"

export type UserRole = "admin" | "vendor" | "manager" | "laboratorio" | "comercial" | "administracion" | string
export type ModuleType = "clientes" | "cotizadora" | "configuracion" | "proyectos" | "usuarios" | "auditoria" | "programacion" | "permisos" | "laboratorio" | "comercial" | "administracion" | "verificacion_muestras" | "recepcion" | "compresion" | "tracing" | "humedad"

export interface Permission {
    read: boolean
    write: boolean
    delete: boolean
}

export interface RolePermissions {
    [key: string]: Permission
}

export interface User {
    id: string
    name: string
    email: string
    phone?: string
    role: UserRole
    roleLabel?: string
    permissions?: RolePermissions
    avatar?: string
}

// Module-level cache - persists across component re-mounts
let cachedUser: User | null = null
let hasInitialized = false
let globalSessionStart = new Date().toISOString() // GLOBAL TIME FOR LOGOUT COMPARISON

// --- Singleton Channel Management ---
let globalChannel: any = null
let globalChannelUserId: string | null = null
let lastSeenLogoutAt: string | null = null
let isGlobalSessionTerminated = false
const SESSION_TERMINATED_EVENT = "crm-session-terminated"
const TERMINATED_KEY = "crm_is_terminated"

// Initialize global state from localStorage if available (Persistence)
if (typeof window !== 'undefined' && localStorage.getItem(TERMINATED_KEY) === 'true') {
    isGlobalSessionTerminated = true
}

// --- Helper Functions (Hoisted) ---

async function fetchProfile(userId: string) {
    try {
        const { data: profile, error } = await supabase
            .from("perfiles")
            .select("full_name, role, phone, avatar_url, last_force_logout_at")
            .eq("id", userId)
            .single()

        if (error) {
            console.error("[Auth] Error fetching profile:", error)
            return null
        }

        // Fetch role_definitions separately to avoid PostgREST FK join issues with RLS
        if (profile?.role) {
            const { data: roleDef } = await supabase
                .from("role_definitions")
                .select("label, permissions")
                .eq("role_id", profile.role)
                .single()

            if (roleDef) {
                return { ...profile, role_definitions: roleDef }
            }
        }

        return { ...profile, role_definitions: null }
    } catch (e) {
        console.error("[Auth] Exception fetching profile:", e)
        return null
    }
}

async function fetchRolePermissions(roleId: string): Promise<RolePermissions | null> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
        const response = await authFetch(`${apiUrl}/roles`)
        if (!response.ok) return null
        const roles = await response.json()
        const roleData = roles.find((r: any) => r.role_id === roleId)
        if (roleData?.permissions) {
            return roleData.permissions
        }
        return null
    } catch (e) {
        console.error("[Auth] Error fetching role permissions:", e)
        return null
    }
}


async function buildUser(session: any): Promise<User> {
    const profile = await fetchProfile(session.user.id)

    // Capture the current logout timestamp to avoid triggering on it during Live session
    if (profile?.last_force_logout_at) {
        lastSeenLogoutAt = profile.last_force_logout_at
    }

    // Role initialization
    const roleFromProfile = profile?.role || session.user.user_metadata?.role || "vendor"
    const role = roleFromProfile.toLowerCase() as UserRole
    const roleDef = Array.isArray(profile?.role_definitions) ? profile?.role_definitions[0] : profile?.role_definitions

    // 1. Prioritize permissions from database (Supabase Join or API)
    let permissions = roleDef?.permissions
    if (!permissions || Object.keys(permissions).length === 0) {
        console.log(`[Auth] No permissions from Supabase join, fetching from API for role: ${roleFromProfile}`)
        permissions = await fetchRolePermissions(roleFromProfile)
    }

    // --- Active Enforcement Layer (LAW & SECURITY) ---
    const enforcePermissions = (perms: RolePermissions): RolePermissions => {
        const p = { ...perms }
        const r = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        // CRITICAL: Only exact 'admin' role gets full bypass (not 'administrativo' or others)
        const isSuperAdmin = r === 'admin'

        // LAW: Everyone can see their settings/config
        p.configuracion = { read: true, write: p.configuracion?.write || false, delete: false }

        // Logic for specialized roles (ONLY if permissions are missing or we need to block critical gaps)
        if (isSuperAdmin) {
            // Only superadmin gets everything
            return {
                clientes: { read: true, write: true, delete: true },
                proyectos: { read: true, write: true, delete: true },
                cotizadora: { read: true, write: true, delete: true },
                programacion: { read: true, write: true, delete: true },
                laboratorio: { read: true, write: true, delete: true },
                comercial: { read: true, write: true, delete: true },
                administracion: { read: true, write: true, delete: true },
                configuracion: { read: true, write: true, delete: true },
                usuarios: { read: true, write: true, delete: true },
                auditoria: { read: true, write: true, delete: true },
                permisos: { read: true, write: true, delete: true },
                verificacion_muestras: { read: true, write: true, delete: true },
                compresion: { read: true, write: true, delete: true }
            }
        }

        return p
    }

    // Process permissions
    const rNorm = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const isSuperAdminFinal = rNorm === 'admin'  // Only exact 'admin' role


    if (permissions && Object.keys(permissions).length > 0) {
        permissions = enforcePermissions(permissions)
    } else {
        console.log("[Auth] No matrix permissions found, using role-based safety fallbacks")
        // Admin protection: If matrix fails, Admin STILL gets everything
        if (isSuperAdminFinal) {
            permissions = enforcePermissions({})
        } else if (rNorm.includes('asesor') || rNorm.includes('vendedor') || rNorm.includes('vendor')) {
            permissions = {
                clientes: { read: true, write: true, delete: false },
                proyectos: { read: true, write: true, delete: false },
                cotizadora: { read: true, write: true, delete: false },
                comercial: { read: true, write: true, delete: false },
                programacion: { read: true, write: false, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else if (role.includes('laboratorio')) {
            const isLector = role.includes('lector')
            permissions = {
                programacion: { read: true, write: !isLector, delete: false },
                laboratorio: { read: true, write: !isLector, delete: false },
                verificacion_muestras: { read: true, write: !isLector, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else {
            console.log(`[Auth] Minimal fallback for unknown role: ${role}`)
            permissions = {
                configuracion: { read: true, write: false, delete: false }
            }
        }
    }


    return {
        id: session.user.id,
        name: (profile as any)?.full_name || session.user.email?.split("@")[0] || "Usuario",
        email: session.user.email!,
        role: role,
        roleLabel: roleDef?.label || (role === 'admin' ? "Administrador" : (role === 'laboratorio_lector' || role === 'laboratorio') ? "Control Laboratorio" : profile?.role || "Vendedor"),
        permissions: permissions,
        phone: (profile as any)?.phone,
        avatar: (profile as any)?.avatar_url
    }
}


// Function to reset cache (useful for fresh login)
export function resetAuthCache() {
    cachedUser = null
    hasInitialized = false
    globalSessionStart = new Date().toISOString()
    if (globalChannel) {
        supabase.removeChannel(globalChannel)
        globalChannel = null
        globalChannelUserId = null
    }
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(cachedUser)
    const [loading, setLoading] = useState(!hasInitialized)
    // Force sync with module variable
    const [isSessionTerminated, setIsSessionTerminated] = useState(isGlobalSessionTerminated)
    const mountedRef = useRef(true)

    // Force re-check on every render (even if state failed)
    const effectiveSessionTerminated = isSessionTerminated || isGlobalSessionTerminated
    if (effectiveSessionTerminated && !isSessionTerminated) {
        // If global is true but local is false, schedule a fix
        // (but effectiveSessionTerminated will be correct in return)
    }

    const signOut = async () => {
        setLoading(true)
        cachedUser = null
        hasInitialized = false
        clearTerminationState() // Reset termination state on manual/clean logout
        try {
            await deleteSessionAction()
            await supabase.auth.signOut()
            resetAuthCache() // Cleanup channel and global state
            if (mountedRef.current) {
                setUser(null)
            }
            window.location.href = "/login"
        } catch (e) {
            console.error("Sign out error:", e)
            window.location.href = "/login"
        } finally {
            if (mountedRef.current) {
                setLoading(false)
            }
        }
    }

    const clearTerminationState = () => {
        isGlobalSessionTerminated = false
        if (typeof window !== 'undefined') localStorage.removeItem(TERMINATED_KEY)
    }



    // --- Heartbeat & Realtime Guard ---
    useEffect(() => {
        const handler = () => {
            isGlobalSessionTerminated = true
            if (typeof window !== 'undefined') localStorage.setItem(TERMINATED_KEY, 'true')
            if (mountedRef.current) {
                setIsSessionTerminated(true)
            }
        }
        window.addEventListener(SESSION_TERMINATED_EVENT, handler)

        // Immediate check on mount
        if (isGlobalSessionTerminated) {
            setIsSessionTerminated(true)
        }

        return () => window.removeEventListener(SESSION_TERMINATED_EVENT, handler)
    }, [])

    useEffect(() => {
        const currentUserId = user?.id
        if (!currentUserId) return

        // Singleton Guard: Only subscribe once per USER across all hook instances
        if (globalChannel && globalChannelUserId === currentUserId) {
            return
        }

        // Cleanup previous if exists
        if (globalChannel) {
            supabase.removeChannel(globalChannel)
            globalChannel = null
        }

        // console.log(`[Guard] Monitoring for ${currentUserId}...`) // Removed diagnostic tag

        const channel = supabase
            .channel(`guard_${currentUserId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${currentUserId}` },
                (payload) => {
                    const newUser = payload.new as any

                    if (newUser) {
                        const newLogoutAt = newUser.last_force_logout_at

                        // Strict check: if column exists and is different from what we know
                        if (newLogoutAt !== undefined && newLogoutAt !== lastSeenLogoutAt) {
                            if (newLogoutAt === null) {
                                lastSeenLogoutAt = null
                                return
                            }

                            console.warn("!!! REMOTE LOGOUT SIGNAL RECEIVED !!!")
                            lastSeenLogoutAt = newLogoutAt
                            window.dispatchEvent(new CustomEvent(SESSION_TERMINATED_EVENT))
                        }
                    }
                }
            )
            .subscribe()

        globalChannel = channel
        globalChannelUserId = currentUserId

        // Heartbeat (remains local to each user session start, but let's keep it simple)
        // CHECK: If session is terminated, DO NOT start heartbeat
        if (isSessionTerminated) {
            return
        }

        const sendHeartbeat = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            try {
                await authFetch(`${apiUrl}/users/heartbeat`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: currentUserId })
                })
            } catch (err) { }
        }

        sendHeartbeat()
        const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000)

        return () => {
            clearInterval(heartbeatInterval)
            // We DO NOT remove globalChannel here, it stays in module scope 
            // until the tab closes or the user ID changes.
        }
    }, [user?.id, isSessionTerminated]) // Depend on isSessionTerminated

    useEffect(() => {
        mountedRef.current = true

        const init = async () => {
            if (hasInitialized && cachedUser) {
                setUser(cachedUser)
                setLoading(false)
                return
            }

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                cachedUser = null
                hasInitialized = true
                if (mountedRef.current) { setUser(null); setLoading(false); }
                return
            }

            const newUser = await buildUser(session)
            cachedUser = newUser
            hasInitialized = true
            if (mountedRef.current) { setUser(newUser); setLoading(false); }
        }

        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") {
                cachedUser = null
                hasInitialized = false
                if (mountedRef.current) { setUser(null); setLoading(false); }
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {

                // Active Defense: If session is terminated, block re-login
                if (isGlobalSessionTerminated) {
                    supabase.auth.signOut().then(() => {
                        // DO NOT REDIRECT! Let the UI handle the terminated state
                        console.log("Active defense signed out. UI should show modal.")
                    })
                    return
                }

                if (session && session.user.id !== cachedUser?.id) {
                    globalSessionStart = new Date().toISOString()
                    buildUser(session).then(newUser => {
                        cachedUser = newUser
                        hasInitialized = true
                        if (mountedRef.current) { setUser(newUser); setLoading(false); }
                    })
                }
            }
        })

        return () => {
            mountedRef.current = false
            subscription.unsubscribe()
        }
    }, [])

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            const newUser = await buildUser(session)
            cachedUser = newUser
            setUser(newUser)
        }
    }

    return { user, loading, signOut, refreshUser, isSessionTerminated: effectiveSessionTerminated }
}
