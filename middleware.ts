import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const { pathname } = req.nextUrl

    // SECURITY HEADERS
    res.headers.set('X-Frame-Options', 'DENY') // Prevent clickjacking
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    // 1. Define Public Routes
    const isPublicRoute =
        pathname === '/login' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/favicon.ico' ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)

    if (isPublicRoute) {
        return res
    }

    // 2. Check Session Cookie
    const sessionId = req.cookies.get('crm_session')?.value

    if (!sessionId) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // 3. Verify Session & Get Role using Service Key (High Privilege)
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new Error("Missing Supabase Config")
        }

        // Initialize Supabase Client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        })

        // 1. Get Session including login timestamp
        const { data: sessionData, error: sessionError } = await supabase
            .from('active_sessions')
            .select('user_id, last_login_at')
            .eq('session_id', sessionId)
            .single()

        if (sessionError || !sessionData) {
            console.error("Middleware Session Check Failed:", sessionError?.message || "No Session Data")
            const response = NextResponse.redirect(new URL('/login?error=session_expired', req.url))
            response.cookies.delete('crm_session')
            return response
        }

        const userId = sessionData.user_id

        // 2. Get Role & Force Logout Timestamp
        const { data: userData, error: userError } = await supabase
            .from('perfiles')
            .select('role, last_force_logout_at')
            .eq('id', userId)
            .single()

        if (userError || !userData) {
            console.error("Middleware User Lookup Failed:", userError?.message)
            const response = NextResponse.redirect(new URL('/login?error=user_not_found', req.url))
            response.cookies.delete('crm_session')
            return response
        }

        const role = userData.role || null
        const lastForceLogout = userData.last_force_logout_at ? new Date(userData.last_force_logout_at).getTime() : 0
        const sessionLastLogin = sessionData.last_login_at ? new Date(sessionData.last_login_at).getTime() : 0

        // 3. Force Logout Check: If force logout happened AFTER login, kill session
        if (lastForceLogout > sessionLastLogin) {
            console.warn(`[Middleware] Force Logout Detected for user ${userId}. Logout: ${lastForceLogout} > Login: ${sessionLastLogin}`)
            const response = NextResponse.redirect(new URL('/login?error=force_logout', req.url))
            // Clean up invalid session from DB (optional cleanup, good practice)
            await supabase.from('active_sessions').delete().eq('session_id', sessionId)
            response.cookies.delete('crm_session')
            return response
        }

        // 4. Role Based Access Control (RBAC)

        // Super Admin: Acceso Total
        if (role === 'admin') {
            return res
        }

        // Acceso a módulos sensibles (Solo Admin)
        const isSensitiveRoute =
            pathname.startsWith('/usuarios') ||
            pathname.startsWith('/permisos') ||
            pathname.startsWith('/auditoria')

        if (isSensitiveRoute && role !== 'admin') {
            return NextResponse.redirect(new URL('/unauthorized', req.url))
        }

        // Admin General: Todo menos sensible
        if (role === 'admin_general') {
            return res
        }

        // Laboratorio Routes
        if (pathname.startsWith('/laboratorio') || pathname.startsWith('/programacion')) {
            const allowedRoles = ['admin', 'admin_general', 'laboratorio_tipificador', 'laboratorio_lector', 'administrativo', 'asesor comercial']
            if (!allowedRoles.includes(role || "")) {
                return NextResponse.redirect(new URL('/unauthorized', req.url))
            }
        }

        // Comercial / Operativo Routes
        if (pathname.startsWith('/comercial') || pathname.startsWith('/cotizaciones') || pathname.startsWith('/clientes') || pathname.startsWith('/proyectos')) {
            const allowedRoles = ['admin', 'admin_general', 'administrativo', 'asesor comercial']
            if (!allowedRoles.includes(role || "")) {
                return NextResponse.redirect(new URL('/unauthorized', req.url))
            }
        }

        return res

    } catch (err) {
        console.error("Middleware Error:", err)
        return NextResponse.redirect(new URL('/login?error=server_error', req.url))
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
