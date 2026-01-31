"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { deleteSessionAction } from "@/app/actions/auth-actions"

export type UserRole = "admin" | "vendor" | "manager" | "laboratorio" | "comercial" | "administracion" | string
export type ModuleType = "clientes" | "cotizadora" | "configuracion" | "proyectos" | "usuarios" | "auditoria" | "programacion" | "permisos" | "laboratorio"

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
        const { data, error } = await supabase
            .from("perfiles")
            .select("full_name, role, phone, avatar_url, last_force_logout_at, role_definitions!fk_perfiles_role(label, permissions)")
            .eq("id", userId)
            .single()

        if (error) {
            console.error("[Auth] Error fetching profile:", error)
            return null
        }
        return data
    } catch (e) {
        console.error("[Auth] Exception fetching profile:", e)
        return null
    }
}

async function buildUser(session: any): Promise<User> {
    const profile = await fetchProfile(session.user.id)

    // Capture the current logout timestamp to avoid triggering on it during Live session
    if (profile?.last_force_logout_at) {
        lastSeenLogoutAt = profile.last_force_logout_at
        // console.log(`[Auth] Initialized lastSeenLogoutAt to: ${lastSeenLogoutAt}`) // Removed diagnostic tag
    }
    const defaultPermissions: RolePermissions = {
        clientes: { read: true, write: true, delete: false },
        proyectos: { read: true, write: true, delete: false },
        cotizadora: { read: true, write: true, delete: false },
        programacion: { read: true, write: false, delete: false },
    }

    const role = (profile?.role?.toLowerCase() as UserRole) || (session.user.user_metadata?.role?.toLowerCase() as UserRole) || "vendor"
    const roleDef = Array.isArray(profile?.role_definitions) ? profile?.role_definitions[0] : profile?.role_definitions
    let permissions = roleDef?.permissions || defaultPermissions

    return {
        id: session.user.id,
        name: (profile as any)?.full_name || session.user.email?.split("@")[0] || "Usuario",
        email: session.user.email!,
        role: role,
        roleLabel: roleDef?.label || (role === 'admin' ? "Administrador" : "Vendedor"),
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            try {
                await fetch(`${apiUrl}/users/heartbeat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            console.log(`[Auth] Event: ${event}`)
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
