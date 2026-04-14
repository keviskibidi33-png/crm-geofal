"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { getOrCreateBrowserId } from "@/lib/browser-session"
import { deleteServerSession, refreshServerSession } from "@/lib/session-api"

export type UserRole = "admin" | "vendor" | "manager" | "laboratorio" | "jefe_laboratorio" | "tecnico_general" | "comercial" | "administracion" | "tecnico_suelos" | string
export type ModuleType = "clientes" | "cotizadora" | "configuracion" | "proyectos" | "usuarios" | "auditoria" | "programacion" | "permisos" | "laboratorio" | "oficina_tecnica" | "comercial" | "administracion" | "verificacion_muestras" | "recepcion" | "compresion" | "tracing" | "humedad" | "cont_humedad" | "planas" | "caras" | "cbr" | "proctor" | "llp" | "gran_suelo" | "gran_agregado" | "cont_mat_organica" | "terrones_fino_grueso" | "azul_metileno" | "part_livianas" | "imp_organicas" | "sul_magnesio" | "angularidad" | "abra" | "abrass" | "peso_unitario" | "tamiz" | "equi_arena" | "ge_fino" | "ge_grueso" | "cd" | "ph" | "cloro_soluble" | "sales_solubles" | "sulfatos_solubles" | "compresion_no_confinada"

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

const CONTROL_ACCESS_REVOKED_EMAILS = new Set([
    "tecnico2@geofal.com.pe",
    "tecnico3@geofal.com.pe",
])

const AUTH_DEBUG_LOGS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_AUTH === "true"

function authDebugLog(...args: unknown[]) {
    if (AUTH_DEBUG_LOGS) {
        console.log(...args)
    }
}

// Module-level cache - persists across component re-mounts
let cachedUser: User | null = null
let hasInitialized = false

// --- Singleton Channel Management ---
let globalChannel: any = null
let globalChannelUserId: string | null = null
let lastSeenLogoutAt: string | null = null
let isGlobalSessionTerminated = false
const SESSION_TERMINATED_EVENT = "crm-session-terminated"
const TERMINATED_KEY = "crm_is_terminated"
const BOOTSTRAP_TIMEOUT_MS = 8000
const SESSION_REFRESH_THROTTLE_MS = 60 * 1000
const SESSION_LOSS_GRACE_MS = 3 * 60 * 1000
let lastSessionRefreshAt = 0
let refreshInFlight: Promise<void> | null = null
let globalActivityListenerUserId: string | null = null
let globalActivityListenerCleanup: (() => void) | null = null

type BootstrapStage = "getSession" | "buildUser" | "fetchProfile" | "fetchRoleDefinition"

class AuthBootstrapError extends Error {
    stage: BootstrapStage

    constructor(stage: BootstrapStage, message: string) {
        super(message)
        this.name = "AuthBootstrapError"
        this.stage = stage
    }
}

const BOOTSTRAP_TIMEOUT_MESSAGES: Record<BootstrapStage, string> = {
    getSession: "No se pudo recuperar tu sesión del CRM a tiempo.",
    buildUser: "No se pudo cargar tu acceso al CRM a tiempo.",
    fetchProfile: "La lectura del perfil tardó demasiado.",
    fetchRoleDefinition: "La lectura de permisos tardó demasiado.",
}

// Initialize global state from localStorage if available (Persistence)
if (typeof window !== 'undefined' && localStorage.getItem(TERMINATED_KEY) === 'true') {
    isGlobalSessionTerminated = true
}

// --- Helper Functions (Hoisted) ---

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof AuthBootstrapError) return error.message
    if (error instanceof Error && error.message) return error.message
    return fallback
}

function logBootstrapError(stage: BootstrapStage, error: unknown, startedAt: number) {
    console.error("[AuthBootstrap]", {
        stage,
        message: getErrorMessage(error, BOOTSTRAP_TIMEOUT_MESSAGES[stage]),
        elapsedMs: Date.now() - startedAt,
    })
}

function attachAbortSignal<T>(query: T, signal?: AbortSignal): T {
    if (!signal) return query
    const abortableQuery = query as T & { abortSignal?: (nextSignal: AbortSignal) => T }
    if (typeof abortableQuery.abortSignal === "function") {
        return abortableQuery.abortSignal(signal)
    }
    return query
}

async function withTimeout<T>(
    stage: BootstrapStage,
    task: (signal?: AbortSignal) => Promise<T>,
    timeoutMs: number = BOOTSTRAP_TIMEOUT_MS,
    timeoutMessage: string = BOOTSTRAP_TIMEOUT_MESSAGES[stage],
): Promise<T> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
        return await Promise.race([
            task(controller?.signal),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller?.abort()
                    reject(new AuthBootstrapError(stage, timeoutMessage))
                }, timeoutMs)
            }),
        ])
    } catch (error) {
        if (error instanceof AuthBootstrapError) {
            throw error
        }
        const message = controller?.signal.aborted
            ? timeoutMessage
            : getErrorMessage(error, timeoutMessage)
        throw new AuthBootstrapError(stage, message)
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

async function fetchProfile(userId: string) {
    try {
        const { data: profile, error } = await withTimeout(
            "fetchProfile",
            async (signal) => {
                const query = attachAbortSignal(
                    supabase
                        .from("perfiles")
                        .select("full_name, role, phone, avatar_url, last_force_logout_at")
                        .eq("id", userId)
                        .single(),
                    signal,
                )
                return await query
            },
        )

        authDebugLog("[Auth] Profile query result:", { profile, error })

        if (error) {
            console.error("[Auth] Error fetching profile:", error)
            return null
        }

        // Fetch role_definitions separately to avoid PostgREST FK join issues with RLS
        if (profile?.role) {
            const { data: roleDef, error: roleError } = await withTimeout(
                "fetchRoleDefinition",
                async (signal) => {
                    const query = attachAbortSignal(
                        supabase
                            .from("role_definitions")
                            .select("label, permissions")
                            .eq("role_id", profile.role)
                            .single(),
                        signal,
                    )
                    return await query
                },
            )

            authDebugLog("[Auth] RoleDef query result:", { roleDef, roleError, roleId: profile.role })

            if (roleDef) {
                const result = { ...profile, role_definitions: roleDef }
                authDebugLog("[Auth] Final profile with roleDef:", result)
                return result
            }
        }

        authDebugLog("[Auth] Returning profile WITHOUT roleDef")
        return { ...profile, role_definitions: null }
    } catch (e) {
        if (e instanceof AuthBootstrapError) {
            throw e
        }
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
    const normalizedEmail = String(session.user.email || "").toLowerCase().trim()

    // Capture the current logout timestamp to avoid triggering on it during Live session
    if (profile?.last_force_logout_at) {
        lastSeenLogoutAt = profile.last_force_logout_at
    }

    // Role initialization
    const roleFromProfile = profile?.role || session.user.user_metadata?.role || "vendor"
    const role = roleFromProfile.toLowerCase() as UserRole
    const rNorm = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const roleDef = Array.isArray(profile?.role_definitions) ? profile?.role_definitions[0] : profile?.role_definitions

    // 1. Prioritize permissions from database (Supabase Join or API)
    let permissions = roleDef?.permissions
    if (!permissions || Object.keys(permissions).length === 0) {
        authDebugLog(`[Auth] No permissions from Supabase join, fetching from API for role: ${roleFromProfile}`)
        permissions = await fetchRolePermissions(roleFromProfile)
    }

    // --- Active Enforcement Layer (LAW & SECURITY) ---
    const enforcePermissions = (perms: RolePermissions): RolePermissions => {
        const p = { ...perms }
        const r = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        // CRITICAL: Only exact 'admin' role gets full bypass (not 'administrativo' or others)
        const isSuperAdmin = r === 'admin'

        // Alias mapping: DB uses 'verificacion' but sidebar uses 'verificacion_muestras'
        if (p.verificacion && !p.verificacion_muestras) {
            p.verificacion_muestras = p.verificacion
        }

        // LAW: Everyone can see their settings/config
        p.configuracion = { read: true, write: p.configuracion?.write || false, delete: false }

        // Business rule: programacion read access for all authenticated users (scheduling).
        // Write/delete remain role-based.
        p.programacion = {
            read: true,
            write: p.programacion?.write || false,
            delete: p.programacion?.delete || false
        }
        // Laboratorio: always readable for all users (lab overview)
        p.laboratorio = { read: true, write: p.laboratorio?.write || false, delete: p.laboratorio?.delete || false }
        // Control modules: only enforce read:true if already present in permissions matrix.
        // This prevents lab-only roles from seeing commercial/admin dashboards.
        if (p.comercial) {
            p.comercial = { read: true, write: p.comercial?.write || false, delete: p.comercial?.delete || false }
        }
        if (p.administracion) {
            p.administracion = { read: true, write: p.administracion?.write || false, delete: p.administracion?.delete || false }
        }

        // Compatibility fallback: if llp key is missing in older role matrices,
        // inherit the same access profile from Proctor.
        if (!p.llp) {
            p.llp = {
                read: p.proctor?.read || false,
                write: p.proctor?.write || false,
                delete: p.proctor?.delete || false,
            }
        }
        if (!p.cont_humedad) {
            p.cont_humedad = {
                read: p.humedad?.read || p.llp?.read || p.proctor?.read || false,
                write: p.humedad?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.humedad?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.gran_suelo) {
            p.gran_suelo = {
                read: p.llp?.read || p.proctor?.read || false,
                write: p.llp?.write || p.proctor?.write || false,
                delete: p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.gran_agregado) {
            p.gran_agregado = {
                read: p.llp?.read || p.proctor?.read || false,
                write: p.llp?.write || p.proctor?.write || false,
                delete: p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.cont_mat_organica) {
            p.cont_mat_organica = {
                read: p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.terrones_fino_grueso) {
            p.terrones_fino_grueso = {
                read: p.cont_mat_organica?.read || p.gran_agregado?.read || false,
                write: p.cont_mat_organica?.write || p.gran_agregado?.write || false,
                delete: p.cont_mat_organica?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.azul_metileno) {
            p.azul_metileno = {
                read: p.terrones_fino_grueso?.read || p.cont_mat_organica?.read || p.gran_agregado?.read || false,
                write: p.terrones_fino_grueso?.write || p.cont_mat_organica?.write || p.gran_agregado?.write || false,
                delete: p.terrones_fino_grueso?.delete || p.cont_mat_organica?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.part_livianas) {
            p.part_livianas = {
                read: p.azul_metileno?.read || p.gran_agregado?.read || false,
                write: p.azul_metileno?.write || p.gran_agregado?.write || false,
                delete: p.azul_metileno?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.imp_organicas) {
            p.imp_organicas = {
                read: p.part_livianas?.read || p.azul_metileno?.read || p.gran_agregado?.read || false,
                write: p.part_livianas?.write || p.azul_metileno?.write || p.gran_agregado?.write || false,
                delete: p.part_livianas?.delete || p.azul_metileno?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.sul_magnesio) {
            p.sul_magnesio = {
                read: p.imp_organicas?.read || p.part_livianas?.read || p.gran_agregado?.read || false,
                write: p.imp_organicas?.write || p.part_livianas?.write || p.gran_agregado?.write || false,
                delete: p.imp_organicas?.delete || p.part_livianas?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.angularidad) {
            p.angularidad = {
                read: p.sul_magnesio?.read || p.ge_fino?.read || p.gran_agregado?.read || false,
                write: p.sul_magnesio?.write || p.ge_fino?.write || p.gran_agregado?.write || false,
                delete: p.sul_magnesio?.delete || p.ge_fino?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.abra) {
            p.abra = {
                read: p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.abrass) {
            p.abrass = {
                read: p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.peso_unitario) {
            p.peso_unitario = {
                read: p.abrass?.read || p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.abrass?.write || p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.tamiz) {
            p.tamiz = {
                read: p.peso_unitario?.read || p.abrass?.read || p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.peso_unitario?.write || p.abrass?.write || p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.peso_unitario?.delete || p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.planas) {
            p.planas = {
                read: p.tamiz?.read || p.cont_humedad?.read || p.humedad?.read || false,
                write: p.tamiz?.write || p.cont_humedad?.write || p.humedad?.write || false,
                delete: p.tamiz?.delete || p.cont_humedad?.delete || p.humedad?.delete || false,
            }
        }
        if (!p.caras) {
            p.caras = {
                read: p.planas?.read || p.tamiz?.read || p.peso_unitario?.read || p.abrass?.read || p.abra?.read || p.gran_agregado?.read || false,
                write: p.planas?.write || p.tamiz?.write || p.peso_unitario?.write || p.abrass?.write || p.abra?.write || p.gran_agregado?.write || false,
                delete: p.planas?.delete || p.tamiz?.delete || p.peso_unitario?.delete || p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || false,
            }
        }
        if (!p.equi_arena) {
            p.equi_arena = {
                read: p.caras?.read || p.planas?.read || p.tamiz?.read || p.peso_unitario?.read || p.abrass?.read || p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.caras?.write || p.planas?.write || p.tamiz?.write || p.peso_unitario?.write || p.abrass?.write || p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.caras?.delete || p.planas?.delete || p.tamiz?.delete || p.peso_unitario?.delete || p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.ge_fino) {
            p.ge_fino = {
                read: p.equi_arena?.read || p.tamiz?.read || p.peso_unitario?.read || p.abrass?.read || p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.equi_arena?.write || p.tamiz?.write || p.peso_unitario?.write || p.abrass?.write || p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.equi_arena?.delete || p.tamiz?.delete || p.peso_unitario?.delete || p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }
        if (!p.ge_grueso) {
            p.ge_grueso = {
                read: p.ge_fino?.read || p.equi_arena?.read || p.tamiz?.read || p.peso_unitario?.read || p.abrass?.read || p.abra?.read || p.gran_agregado?.read || p.llp?.read || p.proctor?.read || false,
                write: p.ge_fino?.write || p.equi_arena?.write || p.tamiz?.write || p.peso_unitario?.write || p.abrass?.write || p.abra?.write || p.gran_agregado?.write || p.llp?.write || p.proctor?.write || false,
                delete: p.ge_fino?.delete || p.equi_arena?.delete || p.tamiz?.delete || p.peso_unitario?.delete || p.abrass?.delete || p.abra?.delete || p.gran_agregado?.delete || p.llp?.delete || p.proctor?.delete || false,
            }
        }

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
                compresion: { read: true, write: true, delete: true },
                humedad: { read: true, write: true, delete: true },
                cont_humedad: { read: true, write: true, delete: true },
                planas: { read: true, write: true, delete: true },
                caras: { read: true, write: true, delete: true },
                cbr: { read: true, write: true, delete: true },
                proctor: { read: true, write: true, delete: true },
                llp: { read: true, write: true, delete: true },
                gran_suelo: { read: true, write: true, delete: true },
                gran_agregado: { read: true, write: true, delete: true },
                cont_mat_organica: { read: true, write: true, delete: true },
                terrones_fino_grueso: { read: true, write: true, delete: true },
                azul_metileno: { read: true, write: true, delete: true },
                part_livianas: { read: true, write: true, delete: true },
                imp_organicas: { read: true, write: true, delete: true },
                sul_magnesio: { read: true, write: true, delete: true },
                angularidad: { read: true, write: true, delete: true },
                abra: { read: true, write: true, delete: true },
                abrass: { read: true, write: true, delete: true },
                peso_unitario: { read: true, write: true, delete: true },
                tamiz: { read: true, write: true, delete: true },
                equi_arena: { read: true, write: true, delete: true },
                ge_fino: { read: true, write: true, delete: true },
                ge_grueso: { read: true, write: true, delete: true },
            }
        }

        return p
    }

    // Process permissions
    const isSuperAdminFinal = rNorm === 'admin'  // Only exact 'admin' role
    const isStrictTecnicoRole = rNorm === 'tecnico' || rNorm === 'tecnico_no_lab_write'
    const isTecnicoSuelosRole = rNorm === 'tecnico_suelos'

    if (permissions && Object.keys(permissions).length > 0) {
        permissions = enforcePermissions(permissions)
    } else {
        authDebugLog("[Auth] No matrix permissions found, using role-based safety fallbacks")
        // Admin protection: If matrix fails, Admin STILL gets everything
        if (isSuperAdminFinal) {
            permissions = enforcePermissions({})
        } else if (rNorm.includes('asesor') || rNorm.includes('vendedor') || rNorm.includes('vendor') || rNorm.includes('auxiliar')) {
            permissions = {
                clientes: { read: true, write: true, delete: false },
                proyectos: { read: true, write: true, delete: false },
                cotizadora: { read: true, write: true, delete: false },
                laboratorio: { read: true, write: false, delete: false },
                comercial: { read: true, write: true, delete: false },
                administracion: { read: true, write: false, delete: false },
                programacion: { read: true, write: false, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else if (isStrictTecnicoRole) {
            const canEditLab = rNorm !== 'tecnico_no_lab_write'
            permissions = {
                tracing: { read: true, write: false, delete: false },
                recepcion: { read: true, write: false, delete: false },
                verificacion_muestras: { read: true, write: canEditLab, delete: false },
                compresion: { read: true, write: canEditLab, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else if (isTecnicoSuelosRole) {
            permissions = {
                humedad: { read: true, write: true, delete: false },
                cont_humedad: { read: true, write: true, delete: false },
                cbr: { read: true, write: true, delete: false },
                proctor: { read: true, write: true, delete: false },
                llp: { read: true, write: true, delete: false },
                gran_suelo: { read: true, write: true, delete: false },
                gran_agregado: { read: true, write: true, delete: false },
                cont_mat_organica: { read: true, write: true, delete: false },
                terrones_fino_grueso: { read: true, write: true, delete: false },
                azul_metileno: { read: true, write: true, delete: false },
                part_livianas: { read: true, write: true, delete: false },
                imp_organicas: { read: true, write: true, delete: false },
                sul_magnesio: { read: true, write: true, delete: false },
                angularidad: { read: true, write: true, delete: false },
                abra: { read: true, write: true, delete: false },
                abrass: { read: true, write: true, delete: false },
                peso_unitario: { read: true, write: true, delete: false },
                tamiz: { read: true, write: true, delete: false },
                planas: { read: true, write: true, delete: false },
                caras: { read: true, write: true, delete: false },
                equi_arena: { read: true, write: true, delete: false },
                ge_fino: { read: true, write: true, delete: false },
                ge_grueso: { read: true, write: true, delete: false },
                cd: { read: true, write: true, delete: false },
                ph: { read: true, write: true, delete: false },
                cloro_soluble: { read: true, write: true, delete: false },
                sales_solubles: { read: true, write: true, delete: false },
                sulfatos_solubles: { read: true, write: true, delete: false },
                compresion_no_confinada: { read: true, write: true, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else if (role.includes('laboratorio') || role.includes('tipificador')) {
            const isLector = role.includes('lector')
            permissions = {
                programacion: { read: true, write: !isLector, delete: false },
                laboratorio: { read: true, write: !isLector, delete: false },
                comercial: { read: true, write: false, delete: false },
                administracion: { read: true, write: false, delete: false },
                verificacion_muestras: { read: true, write: !isLector, delete: false },
                humedad: { read: true, write: !isLector, delete: false },
                cont_humedad: { read: true, write: !isLector, delete: false },
                proctor: { read: true, write: !isLector, delete: false },
                llp: { read: true, write: !isLector, delete: false },
                gran_suelo: { read: true, write: !isLector, delete: false },
                gran_agregado: { read: true, write: !isLector, delete: false },
                cont_mat_organica: { read: true, write: !isLector, delete: false },
                terrones_fino_grueso: { read: true, write: !isLector, delete: false },
                azul_metileno: { read: true, write: !isLector, delete: false },
                part_livianas: { read: true, write: !isLector, delete: false },
                imp_organicas: { read: true, write: !isLector, delete: false },
                sul_magnesio: { read: true, write: !isLector, delete: false },
                angularidad: { read: true, write: !isLector, delete: false },
                abra: { read: true, write: !isLector, delete: false },
                abrass: { read: true, write: !isLector, delete: false },
                peso_unitario: { read: true, write: !isLector, delete: false },
                tamiz: { read: true, write: !isLector, delete: false },
                planas: { read: true, write: !isLector, delete: false },
                caras: { read: true, write: !isLector, delete: false },
                equi_arena: { read: true, write: !isLector, delete: false },
                ge_fino: { read: true, write: !isLector, delete: false },
                ge_grueso: { read: true, write: !isLector, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        } else {
            authDebugLog(`[Auth] Minimal fallback for unknown role: ${role}`)
            permissions = {
                programacion: { read: true, write: false, delete: false },
                laboratorio: { read: true, write: false, delete: false },
                comercial: { read: true, write: false, delete: false },
                administracion: { read: true, write: false, delete: false },
                configuracion: { read: true, write: false, delete: false }
            }
        }
    }

    // User-specific hotfix: habilitar accesos de Oficina Tecnica 2 segun requerimiento operativo.
    if (normalizedEmail === "oficinatecnica2@geofal.com.pe") {
        const grantWrite = (): Permission => ({
            read: true,
            write: true,
            delete: false,
        })

        permissions = {
            ...(permissions || {}),
            laboratorio: grantWrite(),
            programacion: grantWrite(),
            recepcion: grantWrite(),
            verificacion_muestras: grantWrite(),
            compresion: grantWrite(),
            humedad: grantWrite(),
            cont_humedad: grantWrite(),
            planas: grantWrite(),
            caras: grantWrite(),
            cbr: grantWrite(),
            proctor: grantWrite(),
            llp: grantWrite(),
            gran_suelo: grantWrite(),
            gran_agregado: grantWrite(),
            cont_mat_organica: grantWrite(),
            terrones_fino_grueso: grantWrite(),
            azul_metileno: grantWrite(),
            part_livianas: grantWrite(),
            imp_organicas: grantWrite(),
            sul_magnesio: grantWrite(),
            angularidad: grantWrite(),
            abra: grantWrite(),
            abrass: grantWrite(),
            peso_unitario: grantWrite(),
            tamiz: grantWrite(),
            equi_arena: grantWrite(),
            ge_fino: grantWrite(),
            ge_grueso: grantWrite(),
            cd: grantWrite(),
            ph: grantWrite(),
            cloro_soluble: grantWrite(),
            sales_solubles: grantWrite(),
            sulfatos_solubles: grantWrite(),
            compresion_no_confinada: grantWrite(),
        }
    }

    // User-specific hotfix: Beatriz Parinango García (oficinatecnica6) — acceso adicional a
    // Granulometría Fino/Grueso, LLP, Terrones, Partículas Livianas, Cloruros, Sulfatos, PH,
    // Corte Directo y Compresión No Confinada.
    if (normalizedEmail === "oficinatecnica6@geofal.com.pe") {
        const grantWrite = (): Permission => ({
            read: true,
            write: true,
            delete: false,
        })

        permissions = {
            ...(permissions || {}),
            gran_suelo:              grantWrite(), // Granulometría Fino (suelo)
            gran_agregado:           grantWrite(), // Granulometría Grueso (agregado)
            llp:                     grantWrite(), // Límites
            terrones_fino_grueso:    grantWrite(), // Terrones de grava y fino
            part_livianas:           grantWrite(), // Partículas livianas
            ge_fino:                 grantWrite(), // GE Fino
            ge_grueso:               grantWrite(), // GE Grueso
            cloro_soluble:           grantWrite(), // Cloruros
            sulfatos_solubles:       grantWrite(), // Sulfatos
            ph:                      grantWrite(), // PH Suelo
            cd:                      grantWrite(), // Corte Directo
            compresion_no_confinada: grantWrite(), // Compresión No Confinada (Confinado)
            tamiz:                   grantWrite(), // Malla 200
            sales_solubles:          grantWrite(), // Sales Solubles
        }
    }

    // User-specific hotfix: Johanie (oficiatecnica5) — acceso a
    // Proctor, CBR, Granulometría (fino/grueso), Abrasión y Malla No. 200.
    if (normalizedEmail === "oficiatecnica5@geofal.com.pe") {
        const grantWrite = (): Permission => ({
            read: true,
            write: true,
            delete: false,
        })

        permissions = {
            ...(permissions || {}),
            proctor:       grantWrite(), // Proctor
            cbr:           grantWrite(), // CBR
            gran_suelo:    grantWrite(), // Granulometría Fino (suelo)
            gran_agregado: grantWrite(), // Granulometría Grueso (agregado)
            abra:          grantWrite(), // Abrasión
            tamiz:         grantWrite(), // Malla No. 200
        }
    }

    // Commercial scope lock:
    // Roles comerciales/vendedores only see their business modules.
    const isCommercialScopedRole =
        rNorm.includes('asesor') ||
        rNorm.includes('vendedor') ||
        rNorm.includes('vendor') ||
        rNorm.includes('auxiliar') ||
        rNorm === 'comercial'

    if (isCommercialScopedRole) {
        const source = (permissions || {}) as RolePermissions
        const pick = (key: string): Permission => ({
            read: source[key]?.read === true,
            write: source[key]?.write === true,
            delete: source[key]?.delete === true,
        })

        permissions = {
            clientes: pick('clientes'),
            proyectos: pick('proyectos'),
            cotizadora: pick('cotizadora'),
            comercial: pick('comercial'),
            programacion: pick('programacion'),
            configuracion: pick('configuracion'),
        }
    }

    // Strict technical scope:
    // technical lab roles must only access their explicitly approved soil modules.
    if (isStrictTecnicoRole) {
        const source = (permissions || {}) as RolePermissions
        const pick = (key: string): Permission => ({
            read: source[key]?.read === true,
            write: source[key]?.write === true,
            delete: source[key]?.delete === true,
        })

        permissions = {
            tracing: pick('tracing'),
            recepcion: pick('recepcion'),
            verificacion_muestras: pick('verificacion_muestras'),
            compresion: pick('compresion'),
            configuracion: pick('configuracion'),
        }
    }

    if (CONTROL_ACCESS_REVOKED_EMAILS.has(normalizedEmail)) {
        permissions = {
            ...(permissions || {}),
            laboratorio: { read: false, write: false, delete: false },
            comercial: { read: false, write: false, delete: false },
            administracion: { read: false, write: false, delete: false },
        }
    }


    return {
        id: session.user.id,
        name: (profile as any)?.full_name || session.user.email?.split("@")[0] || "Usuario",
        email: session.user.email!,
        role: role,
        roleLabel: roleDef?.label || (role === 'admin' ? "Administrador" : role === 'tecnico_suelos' ? "Tecnico Laboratorio Suelos" : (role === 'laboratorio_lector' || role === 'laboratorio' || role.includes('tipificador')) ? "Control Laboratorio" : profile?.role || "Vendedor"),
        permissions: permissions,
        phone: (profile as any)?.phone,
        avatar: (profile as any)?.avatar_url
    }
}

async function refreshAuthSession() {
    const now = Date.now()
    if (now - lastSessionRefreshAt < SESSION_REFRESH_THROTTLE_MS) return
    if (refreshInFlight) return
    lastSessionRefreshAt = now
    refreshInFlight = (async () => {
        try {
            const { data, error } = await supabase.auth.refreshSession()
            if (error) return
            if (data?.session?.access_token && typeof window !== 'undefined') {
                localStorage.setItem('token', data.session.access_token)
            }
            if (data?.session) {
                await refreshServerSession(getOrCreateBrowserId())
            }
        } catch {
            // Ignore refresh errors (session may be genuinely expired)
        } finally {
            refreshInFlight = null
        }
    })()
    return refreshInFlight
}


// Function to reset cache (useful for fresh login)
export function resetAuthCache() {
    cachedUser = null
    hasInitialized = false
    lastSeenLogoutAt = null
    lastSessionRefreshAt = 0
    if (globalChannel) {
        supabase.removeChannel(globalChannel)
        globalChannel = null
        globalChannelUserId = null
    }
    if (globalActivityListenerCleanup) {
        globalActivityListenerCleanup()
        globalActivityListenerCleanup = null
        globalActivityListenerUserId = null
    }
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(cachedUser)
    const [loading, setLoading] = useState(!hasInitialized)
    const [bootstrapError, setBootstrapError] = useState<string | null>(null)
    // Force sync with module variable
    const [isSessionTerminated, setIsSessionTerminated] = useState(isGlobalSessionTerminated)
    const mountedRef = useRef(true)
    const bootstrapAuthRef = useRef<() => Promise<void>>(async () => { })

    // Force re-check on every render (even if state failed)
    const effectiveSessionTerminated = isSessionTerminated || isGlobalSessionTerminated
    if (effectiveSessionTerminated && !isSessionTerminated) {
        // If global is true but local is false, schedule a fix
        // (but effectiveSessionTerminated will be correct in return)
    }

    const signOut = async () => {
        setLoading(true)
        setBootstrapError(null)
        cachedUser = null
        hasInitialized = false
        clearTerminationState() // Reset termination state on manual/clean logout
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token')
        }
        try {
            await deleteServerSession()
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

    bootstrapAuthRef.current = async () => {
        const bootstrapStartedAt = Date.now()
        if (mountedRef.current) {
            setLoading(true)
            setBootstrapError(null)
        }

        try {
            if (hasInitialized && cachedUser) {
                const { data: { session: cachedSession } } = await withTimeout(
                    "getSession",
                    async () => await supabase.auth.getSession(),
                )

                if (cachedSession) {
                    if (mountedRef.current) {
                        setUser(cachedUser)
                        setBootstrapError(null)
                        setLoading(false)
                    }
                    return
                }

                cachedUser = null
                hasInitialized = false
            }

            const { data: { session } } = await withTimeout(
                "getSession",
                async () => await supabase.auth.getSession(),
            )

            if (!session) {
                cachedUser = null
                hasInitialized = true
                if (mountedRef.current) {
                    setUser(null)
                    setBootstrapError(null)
                    setLoading(false)
                }
                return
            }

            if (typeof window !== 'undefined' && session.access_token) {
                localStorage.setItem('token', session.access_token)
            }

            const newUser = await withTimeout(
                "buildUser",
                async () => await buildUser(session),
            )

            cachedUser = newUser
            hasInitialized = true
            if (mountedRef.current) {
                setUser(newUser)
                setBootstrapError(null)
                setLoading(false)
            }
        } catch (error) {
            const normalizedError = error instanceof AuthBootstrapError
                ? error
                : new AuthBootstrapError("buildUser", getErrorMessage(error, BOOTSTRAP_TIMEOUT_MESSAGES.buildUser))

            if (normalizedError.stage === "getSession") {
                cachedUser = null
            }

            hasInitialized = true
            logBootstrapError(normalizedError.stage, normalizedError, bootstrapStartedAt)

            if (mountedRef.current) {
                setUser(null)
                setBootstrapError(normalizedError.message)
                setLoading(false)
            }
        }
    }

    const retryBootstrap = async () => {
        await bootstrapAuthRef.current()
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
                await refreshServerSession(getOrCreateBrowserId())
                await authFetch(`${apiUrl}/users/heartbeat`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: currentUserId })
                })
            } catch { }
        }

        sendHeartbeat()
        const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000)

        return () => {
            clearInterval(heartbeatInterval)
            // We DO NOT remove globalChannel here, it stays in module scope 
            // until the tab closes or the user ID changes.
        }
    }, [user?.id, isSessionTerminated]) // Depend on isSessionTerminated

    // Refresh auth session when the tab becomes active again.
    useEffect(() => {
        const currentUserId = user?.id
        if (!currentUserId || isSessionTerminated) {
            if (globalActivityListenerCleanup) {
                globalActivityListenerCleanup()
                globalActivityListenerCleanup = null
                globalActivityListenerUserId = null
            }
            return
        }

        if (globalActivityListenerUserId === currentUserId) return

        if (globalActivityListenerCleanup) {
            globalActivityListenerCleanup()
            globalActivityListenerCleanup = null
        }

        const handleActivity = () => {
            if (document.visibilityState !== "visible") return
            void refreshAuthSession()
        }

        window.addEventListener("focus", handleActivity)
        document.addEventListener("visibilitychange", handleActivity)

        globalActivityListenerCleanup = () => {
            window.removeEventListener("focus", handleActivity)
            document.removeEventListener("visibilitychange", handleActivity)
        }
        globalActivityListenerUserId = currentUserId

        return () => {
            // Global cleanup is handled when user changes or logs out
        }
    }, [user?.id, isSessionTerminated])

    useEffect(() => {
        mountedRef.current = true

        void bootstrapAuthRef.current()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") {
                cachedUser = null
                hasInitialized = false
                if (mountedRef.current) {
                    setBootstrapError(null)
                }
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token')
                }
                if (mountedRef.current) { setUser(null); setLoading(false); }
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                if (session?.access_token && typeof window !== 'undefined') {
                    localStorage.setItem('token', session.access_token)
                }

                // Active Defense: If session is terminated, block re-login
                if (isGlobalSessionTerminated) {
                    supabase.auth.signOut().then(() => {
                        // DO NOT REDIRECT! Let the UI handle the terminated state
                        console.log("Active defense signed out. UI should show modal.")
                    })
                    return
                }

                if (session && session.user.id !== cachedUser?.id) {
                    void bootstrapAuthRef.current()
                }
            }
        })

        return () => {
            mountedRef.current = false
            subscription.unsubscribe()
        }
    }, [])

    // Session coherence guard: if JWT session disappears, drop cached user
    useEffect(() => {
        if (!user?.id) return

        let disposed = false
        let sessionLossStartedAt: number | null = null
        const verifySession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session || disposed) {
                sessionLossStartedAt = null
                return
            }

            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && refreshData?.session) {
                if (typeof window !== 'undefined' && refreshData.session.access_token) {
                    localStorage.setItem('token', refreshData.session.access_token)
                }
                await refreshServerSession(getOrCreateBrowserId())
                sessionLossStartedAt = null
                return
            }

            if (typeof document !== 'undefined' && document.visibilityState !== "visible") {
                return
            }

            if (!sessionLossStartedAt) {
                sessionLossStartedAt = Date.now()
                return
            }

            if ((Date.now() - sessionLossStartedAt) < SESSION_LOSS_GRACE_MS) {
                return
            }

            if (!disposed) {
                cachedUser = null
                hasInitialized = false
                if (mountedRef.current) {
                    setUser(null)
                    setLoading(false)
                }
            }
        }

        verifySession()
        const timer = setInterval(verifySession, 60 * 1000)

        return () => {
            disposed = true
            clearInterval(timer)
        }
    }, [user?.id])

    const refreshUser = async () => {
        try {
            const { data: { session } } = await withTimeout(
                "getSession",
                async () => await supabase.auth.getSession(),
            )
            if (session) {
                const newUser = await withTimeout(
                    "buildUser",
                    async () => await buildUser(session),
                )
                cachedUser = newUser
                setUser(newUser)
            }
        } catch (error) {
            const normalizedError = error instanceof AuthBootstrapError
                ? error
                : new AuthBootstrapError("buildUser", getErrorMessage(error, BOOTSTRAP_TIMEOUT_MESSAGES.buildUser))
            logBootstrapError(normalizedError.stage, normalizedError, Date.now())
        }
    }

    return {
        user,
        loading,
        signOut,
        refreshUser,
        isSessionTerminated: effectiveSessionTerminated,
        bootstrapError,
        retryBootstrap,
    }
}
