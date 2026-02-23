# Integracion Iframe Humedad/CBR/Proctor - Automatizacion y Seguridad

Guia tecnica del patron usado en `crm-geofal` para montar modulos de laboratorio dentro de dialogos iframe.

## 1) Modulos cubiertos

- `HumedadModule` (`src/components/dashboard/humedad-module.tsx`)
- `CBRModule` (`src/components/dashboard/cbr-module.tsx`)
- `ProctorModule` (`src/components/dashboard/proctor-module.tsx`)

Ambos siguen la misma arquitectura:

- Tabla historial en shell
- Modal iframe para alta/edicion
- Bridge de token por `postMessage`
- Refresco de tabla al cerrar modal

## 2) Flujo operativo

1. Usuario abre "Nuevo Ensayo" o "Editar".
2. Shell obtiene token actual de Supabase (`supabase.auth.getSession()`).
3. Shell construye URL iframe:
- base por ENV (`NEXT_PUBLIC_HUMEDAD_FRONTEND_URL` / `NEXT_PUBLIC_CBR_FRONTEND_URL` / `NEXT_PUBLIC_PROCTOR_FRONTEND_URL`)
   - query `token`
   - query `ensayo_id` en modo edicion
4. Iframe carga microfrontend y opera contra API.
5. Al guardar, iframe emite `CLOSE_MODAL`.
6. Shell cierra modal y recarga listado.

## 3) Construccion de URL embebida

### Humedad

- base:
  - `NEXT_PUBLIC_HUMEDAD_FRONTEND_URL`
  - fallback: `NEXT_PUBLIC_HUMEDAD_URL`
  - fallback final: `https://humedad.geofal.com.pe`

### CBR

- base:
  - `NEXT_PUBLIC_CBR_FRONTEND_URL`
  - fallback: `NEXT_PUBLIC_CBR_URL`
  - fallback final: `https://cbr.geofal.com.pe`

### Proctor

- base:
  - `NEXT_PUBLIC_PROCTOR_FRONTEND_URL`
  - fallback: `NEXT_PUBLIC_PROCTOR_URL`
  - fallback final: `https://proctor.geofal.com.pe`

### Query params estandar

- `token=<jwt>`
- `ensayo_id=<id>` (solo edicion)

## 4) Contrato postMessage

### Mensajes entrantes al shell

- `CLOSE_MODAL`
  - cierra el dialogo y recarga historial.
- `TOKEN_REFRESH_REQUEST`
  - shell responde con token renovado.

### Mensaje saliente del shell

- `TOKEN_REFRESH`
  - payload: `{ token: <access_token> }`

## 5) Seguridad aplicada

### En shell

- Token no hardcodeado; siempre sincronizado desde session Supabase.
- Modulo CBR protegido adicionalmente por rol:
  - `RoleGuard` con `admin` / `admin_general`.
- Permisos por modulo en `use-auth.ts` + filtro de sidebar.

### En microfrontend (esperado por contrato)

- `AccessGate` requiere token para operar embebido.
- Interceptor HTTP agrega `Authorization: Bearer`.
- Ante `401` dispara `session-expired`.
- `SessionGuard` solicita refresh periodico (`TOKEN_REFRESH_REQUEST`).

## 6) Automatizacion para nuevo modulo iframe

Checklist para replicar el patron:

1. Crear componente `<NuevoModuloModule />` con:
   - estados `isModalOpen`, `token`, `iframePath`, `editingId`
   - `fetchListado()`
   - `openNew()`, `openEdit()`
2. Implementar `syncIframeToken()` leyendo session Supabase.
3. Construir `iframeSrc` con `URL` + query params (`token`, `id`).
4. Escuchar `window.message` para:
   - `CLOSE_MODAL`
   - `TOKEN_REFRESH_REQUEST`
5. Enviar `TOKEN_REFRESH` al `event.source`.
6. Incluir `SmartIframe` con estados loading/retry/error.
7. Registrar modulo en:
   - `sidebar.tsx`
   - `dashboard/page.tsx`
   - `ModuleType` de `use-auth.ts`
   - matriz de permisos del rol.

## 7) Variables recomendadas en produccion

- `NEXT_PUBLIC_API_URL=https://api.geofal.com.pe`
- `NEXT_PUBLIC_HUMEDAD_FRONTEND_URL=https://humedad.geofal.com.pe`
- `NEXT_PUBLIC_CBR_FRONTEND_URL=https://cbr.geofal.com.pe`
- `NEXT_PUBLIC_PROCTOR_FRONTEND_URL=https://proctor.geofal.com.pe`

## 8) Observacion de hardening

El patron actual funciona y esta operativo. Para endurecer seguridad, se recomienda validar `event.origin` en listeners `postMessage` contra una allowlist de dominios de microfrontends antes de procesar mensajes.
