# Geofal CRM – Estado del proyecto

## Resumen
Este repositorio agrupa todos los entregables del CRM "Geofal". El frontend principal vive en `crm-geofal/` (Next.js 14 + React 18) y ya cuenta con el layout completo del dashboard, módulos iniciales y branding. El subproyecto `cotizacion-twenty/` contiene la cotizadora legacy (Vite) que ahora se embebe como iframe en el CRM para generar cotizaciones sin salir de la app.

## Stack actual
- **Next.js 14 / React 18 / TypeScript** para el dashboard (`crm-geofal`).
- **Tailwind + Shadcn UI + Lucide** para la capa visual.
- **Supabase JS client** (`lib/supabaseClient.ts`) para consumo de datos reales.
- **Vite + React 18** para `cotizacion-twenty/cotizador-web`, usado como herramienta de cotización embebida.
- **Model Context Protocol (MCP)** configurado en Windsurf (`.codeium/windsurf/mcp_config.json`) para abrir un túnel directo al Postgres self-hosted.

## Estructura de carpetas relevante
| Ruta | Descripción |
| --- | --- |
| `crm-geofal/` | Aplicación principal Next.js (dashboard, módulos, UI components). |
| `crm-geofal/components/dashboard/` | Módulos funcionales (clientes, proyectos, cotizadora, diálogos). |
| `crm-geofal/lib/supabaseClient.ts` | Inicialización del cliente Supabase para toda la app. |
| `cotizacion-twenty/cotizador-web/` | Frontend legacy que se carga dentro del CRM vía iframe. |
| `cotizacion-twenty/quotes-service/` | Servicio adicional (pendiente de integrar) relacionado a cotizaciones. |

## Funcionalidades implementadas
1. **Dashboard completo y navegación** (`app/page.tsx`, `components/dashboard/sidebar.tsx`). Sidebar con branding "Geofal CRM", módulos y layout principal en modo claro.
2. **Módulo de Clientes real** (`components/dashboard/clientes-module.tsx`).
   - Lectura de clientes desde Supabase (`lib/supabaseClient.ts`).
   - CRUD básico: creación vía `create-client-dialog.tsx`, actualización de estado, edición inline y eliminación.
   - Manejo de estados de carga/errores y toasts.
3. **Módulo de Proyectos** (`components/dashboard/proyectos-module.tsx`). UI avanzada con filtros, tabs y controles de estado; pendiente de conectar a datos reales pero con lógica de estado preparada.
4. **Módulo de Cotizaciones** (`components/dashboard/cotizadora-module.tsx`).
   - Estadísticas y tablas con filtros por rol (mock data de transición).
   - Botón "Nueva Cotización" abre `create-quote-dialog.tsx` con iframe de la cotizadora real.
5. **Integración cotizadora en modal** (`components/dashboard/create-quote-dialog.tsx`).
   - Iframe configurable vía `NEXT_PUBLIC_COTIZADOR_URL` (fallback `http://localhost:5173`).
   - Botón para abrir en nueva pestaña + estados de fallback.
6. **Configuración Supabase y branding** (`lib/supabaseClient.ts`, `app/layout.tsx`). Título/tema actualizados a "Geofal CRM" y client listo para usar.

## Estado de Supabase/Postgres
- Conexión validada contra `postgresql://postgres:F4xvOgZobs6EBgiAkKkkDKd8Agz7QzLi@192.168.18.250:5432/postgres?sslmode=disable` a través del MCP.
- El esquema `public` todavía no tiene tablas. Para seguir debemos crear al menos: `clientes`, `proyectos`, `cotizaciones`, `usuarios` (o `vendedores`) y tablas auxiliares para documentos.

## Variables de entorno requeridas
Crea un `.env.local` dentro de `crm-geofal/` con:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Opcional, solo para scripts server-side
NEXT_PUBLIC_COTIZADOR_URL=http://localhost:5173  # o URL desplegada
```
Si no se define `NEXT_PUBLIC_COTIZADOR_URL`, el modal usará `http://localhost:5173` como fallback.

## Cómo ejecutar en local
1. **Dashboard (crm-geofal)**
   ```bash
   cd crm-geofal
   npm install
   npm run dev
   ```
   La app queda disponible en `http://localhost:3000`.
2. **Cotizadora embebida**
   ```bash
   cd cotizacion-twenty/cotizador-web
   npm install
   npm run dev
   ```
   Expone `http://localhost:5173`, que el CRM usa por defecto en el iframe.
3. **MCP / Supabase**
   - Windsurf ya incluye `mcp_config.json` para abrir el túnel. Ejecuta un comando MCP o usa la CLI de Supabase apuntando al mismo host.

## Pendientes para terminar el sistema
1. **Definir y crear el esquema completo en Supabase** (clientes, proyectos, cotizaciones, usuarios, documentos, bitácoras) + datos seed.
2. **Integrar Proyectos y Cotizaciones con Supabase** reemplazando los mocks por consultas reales, incluyendo filtros por rol.
3. **Implementar flujo CRUD de cotizaciones** dentro del diálogo (lectura/escritura, carga de documentos, cálculo de "Monto Aprobado").
4. **Sincronizar estados**: actualizar métricas (Total, Monto Aprobado, Pendientes) con datos reales y recalcular al aprobar/rechazar.
5. **Autenticación / roles**: conectar con Clerk o Supabase Auth y garantizar que vendedores solo vean sus prospectos/cotizaciones.
6. **Notificaciones y toasts en tiempo real** tras mutaciones (optimistic UI o subscriptions).
7. **Gestión de archivos de cotización**: almacenar PDF/Excel en Supabase Storage y asociarlos a cotizaciones.
8. **Hardening**: políticas RLS, validación en formularios, manejo de errores y estados de carga consistentes en todos los módulos.
9. **Documentar despliegue** (URLs definitivas, claves y pipelines) una vez que la infraestructura esté lista.

## Próximos pasos sugeridos
1. Diseñar el diagrama entidad-relación final y ejecutar los `CREATE TABLE` en Supabase.
2. Implementar servicios/hooks compartidos para `clientes`, `proyectos` y `cotizaciones` que usen el cliente de Supabase.
3. Migrar gradualmente cada módulo a esos servicios, comenzando por Proyectos (para resolver el bug de estados) y luego Cotizaciones.
4. Conectar la autenticación y aplicar filtros por `user.role` en ambas tablas.
5. Documentar endpoints y flujos adicionales (por ejemplo, integración con `quotes-service`).
