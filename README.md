# CRM Geofal - Next.js

Sistema de gestión de relaciones con clientes (CRM) para Geofal, construido con Next.js 16, TypeScript y Supabase.

## 🚀 Características

- **Gestión de Clientes**: CRUD completo de clientes con información detallada
- **Gestión de Proyectos**: Pipeline de ventas con estados y seguimiento
- **Cotizaciones**: Módulo integrado para visualizar cotizaciones generadas
- **Usuarios**: Sistema de roles (Admin/Vendedor)
- **Dashboard**: Métricas y estadísticas en tiempo real
- **Laboratorio Embebido**: módulos iframe para Humedad, CBR, Proctor, LLP, ABRA y Peso Unitario con bridge de token

## 📋 Requisitos Previos

- Node.js 18 o superior
- npm o pnpm
- Cuenta de Supabase

## 🛠️ Instalación Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.production.example .env.local

# Editar .env.local con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🐳 Despliegue con Docker

### Build local
```bash
docker build -t crm-geofal \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key \
  --build-arg NEXT_PUBLIC_COTIZADOR_URL=https://cotizador.geofal.com.pe \
  --build-arg NEXT_PUBLIC_API_URL=https://api.geofal.com.pe \
  .
```

### Ejecutar contenedor
```bash
docker run -p 3000:3000 crm-geofal
```

## ☁️ Despliegue en Coolify

1. Crear nuevo proyecto en Coolify
2. Conectar este repositorio
3. Configurar variables de entorno (ver `.env.production.example`)
4. Configurar dominio: `crm.geofal.com.pe`
5. Deploy

Coolify detectará automáticamente el `Dockerfile` y configurará Traefik para HTTPS.

## 🔧 Tecnologías

- **Framework**: Next.js 16
- **UI**: Radix UI + Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

## 📁 Estructura del Proyecto

```
crm-geofal/
├── app/                    # App Router de Next.js
│   ├── page.tsx           # Dashboard principal
│   ├── layout.tsx         # Root layout
│   ├── login/             # Página de login
│   └── actions/           # Server Actions
│       ├── auth-actions.ts
│       ├── audit-actions.ts
│       └── delete-actions.ts
├── components/             # Componentes React
│   ├── ui/                # Componentes de UI base (shadcn)
│   └── dashboard/         # Módulos del dashboard
│       ├── clientes-module.tsx
│       ├── proyectos-module.tsx
│       ├── cotizadora-module.tsx
│       ├── usuarios-module.tsx
│       ├── auditoria-module.tsx
│       └── configuracion-module.tsx
├── hooks/                  # Custom hooks
│   ├── use-auth.ts        # Autenticación con caché
│   ├── use-toast.ts       # Notificaciones
│   └── use-mobile.ts      # Detección responsive
├── lib/                    # Utilidades y configuración
│   ├── supabaseClient.ts  # Cliente Supabase
│   └── utils.ts           # Utilidades CN
├── public/                 # Archivos estáticos
└── styles/                 # Estilos globales
```

## 🔐 Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon Key pública |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service Role Key (server-side) |
| `NEXT_PUBLIC_COTIZADOR_URL` | ❌ | URL del cotizador embebido |
| `NEXT_PUBLIC_API_URL` | ❌ | URL de la API de cotizaciones |
| `NEXT_PUBLIC_HUMEDAD_FRONTEND_URL` | ❌ | URL del frontend embebido de Humedad |
| `NEXT_PUBLIC_CBR_FRONTEND_URL` | ❌ | URL del frontend embebido de CBR |
| `NEXT_PUBLIC_PROCTOR_FRONTEND_URL` | ❌ | URL del frontend embebido de Proctor |
| `NEXT_PUBLIC_LLP_FRONTEND_URL` | ❌ | URL del frontend embebido de LLP |
| `NEXT_PUBLIC_ABRA_FRONTEND_URL` | ❌ | URL del frontend embebido de ABRA |
| `NEXT_PUBLIC_PESO_UNITARIO_FRONTEND_URL` | ❌ | URL del frontend embebido de Peso Unitario |

## 👥 Roles y Permisos

| Módulo | Admin | Manager | Vendor |
|--------|-------|---------|--------|
| Clientes | ✅ Full | ✅ Full | ✅ Full |
| Proyectos | ✅ Full | ✅ Full | ✅ Full |
| Cotizaciones | ✅ Full | ✅ Full | ✅ Full |
| Usuarios | ✅ Full | ❌ | ❌ |
| Auditoría | ✅ Full | 👁️ Ver | ❌ |

## 📖 Documentación

Ver `DOCUMENTATION.md` en el proyecto raíz para documentación técnica completa.

Para integración iframe de Humedad, CBR, Proctor y LLP:

- `IFRAME_HUMEDAD_CBR_AUTOMATIZACION_SEGURIDAD.md`

## 📝 Licencia

Propietario - Geofal Laboratorios
