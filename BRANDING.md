# Geofal CRM — Guía de Branding

> Identidad visual, paleta de colores, tipografía y lineamientos de diseño del sistema CRM de Geofal.

---

## 1. Identidad

| Atributo | Valor |
|---|---|
| **Nombre del producto** | Geofal CRM |
| **Subtítulo** | Sistema de Gestión Inteligente |
| **Tagline** | Plataforma centralizada para la gestión técnica, comercial y administrativa |
| **Dominio** | `crm.geofal.com.pe` |
| **Empresa** | Geofal Perú — Ingeniería y Laboratorio de Materiales |
| **Locale** | `es_PE` |

---

## 2. Logotipos

| Archivo | Uso | Ubicación |
|---|---|---|
| `logo-geofal.svg` | Logo principal (sidebar, header) | `/public/logo-geofal.svg` |
| `geofal.svg` | Favicon SVG | `/public/geofal.svg` |
| `icon.svg` | Ícono genérico | `/public/icon.svg` |
| `icon-light-32x32.png` | Favicon claro 32×32 | `/public/icon-light-32x32.png` |
| `icon-dark-32x32.png` | Favicon oscuro 32×32 | `/public/icon-dark-32x32.png` |
| `apple-icon.png` | Apple Touch Icon | `/public/apple-icon.png` |

### Reglas de uso
- El logo siempre se acompaña del texto **"Geofal CRM"** en `font-semibold`.
- Debajo del nombre: **"Panel Administrativo"** en `text-xs text-muted-foreground`.
- Tamaño mínimo del logo: `h-10 w-auto` (40px altura).
- Nunca distorsionar las proporciones del logo.

---

## 3. Paleta de Colores

### 3.1 Tema Claro (Default)

| Token CSS | Valor OKLCH | Hex aprox. | Uso |
|---|---|---|---|
| `--background` | `oklch(0.98 0.005 260)` | `#F8F8FB` | Fondo general |
| `--foreground` | `oklch(0.15 0.01 260)` | `#1A1A2E` | Texto principal |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Tarjetas |
| `--primary` | `oklch(0.55 0.18 220)` | `#2563EB` | Acción primaria, enlaces, sidebar activo |
| `--secondary` | `oklch(0.95 0.005 260)` | `#EDEDF3` | Fondos secundarios |
| `--muted` | `oklch(0.95 0.005 260)` | `#EDEDF3` | Elementos deshabilitados |
| `--muted-foreground` | `oklch(0.45 0.01 260)` | `#6B6B80` | Texto secundario |
| `--accent` | `oklch(0.55 0.18 220)` | `#2563EB` | Highlights |
| `--destructive` | `oklch(0.55 0.2 25)` | `#DC2626` | Errores, eliminación |
| `--border` | `oklch(0.9 0.005 260)` | `#E2E2EA` | Bordes |
| `--ring` | `oklch(0.55 0.18 220)` | `#2563EB` | Focus rings |
| `--success` | `oklch(0.6 0.2 145)` | `#16A34A` | Estados exitosos |
| `--warning` | `oklch(0.7 0.18 85)` | `#EAB308` | Advertencias |

### 3.2 Sidebar (Claro)

| Token | Valor | Uso |
|---|---|---|
| `--sidebar` | `oklch(0.97 0.005 260)` | Fondo sidebar |
| `--sidebar-foreground` | `oklch(0.25 0.01 260)` | Texto sidebar |
| `--sidebar-primary` | `oklch(0.55 0.18 220)` | Ícono activo |
| `--sidebar-accent` | `oklch(0.93 0.005 260)` | Item hover/activo bg |
| `--sidebar-border` | `oklch(0.9 0.005 260)` | Separadores |

### 3.3 Tema Oscuro

| Token | Valor OKLCH | Uso |
|---|---|---|
| `--background` | `oklch(0.13 0.01 260)` | Fondo general |
| `--foreground` | `oklch(0.95 0.01 260)` | Texto principal |
| `--card` | `oklch(0.16 0.01 260)` | Tarjetas |
| `--primary` | `oklch(0.65 0.15 220)` | Acción primaria |
| `--sidebar` | `oklch(0.11 0.01 260)` | Fondo sidebar |

### 3.4 Colores por Módulo (Tablas)

Cada módulo usa colores funcionales en las tablas para agrupar columnas visualmente:

| Grupo | Header (bg) | Cell (bg) | Módulo |
|---|---|---|---|
| Diámetros / Aceptación | `bg-sky-100` | `bg-sky-50` | Verificación |
| Perpendicularidad | `bg-orange-100` | `bg-orange-50` | Verificación |
| Planitud | `bg-emerald-100` | `bg-emerald-50` | Verificación |
| Acción | `bg-indigo-100` | `bg-indigo-50` | Verificación |
| Conformidad | `bg-violet-100` | `bg-violet-50` | Verificación |
| Longitud | `bg-slate-100` | `bg-slate-50` | Verificación |
| Masa / Pesar | `bg-rose-100` | `bg-rose-50` | Verificación |

---

## 4. Tipografía

| Fuente | Variable CSS | Uso |
|---|---|---|
| **Inter** | `--font-sans` | Texto general, UI, formularios |
| **Geist Mono** | `--font-mono` | Código, valores numéricos técnicos |

### Escalas

| Contexto | Clase Tailwind | Peso |
|---|---|---|
| Headers de tabla | `text-[13px] font-black uppercase tracking-tighter` | 900 |
| Datos de tabla | `text-[15px] font-normal` | 400 |
| Etiquetas de formulario | `text-sm font-medium` | 500 |
| Badges / Status | `text-[10px] font-bold uppercase tracking-wider` | 700 |
| Sidebar items | `text-sm font-medium` | 500 |
| Título sidebar | `font-semibold` | 600 |
| Subtítulo sidebar | `text-xs text-muted-foreground` | 400 |

---

## 5. Iconografía

| Librería | Uso |
|---|---|
| **Lucide React** | Sidebar, header, estados, acciones (CRM Shell) |
| **Heroicons** | Tablas, formularios (Compresión, módulos Vite) |

### Íconos por módulo

| Módulo | Ícono | Fuente |
|---|---|---|
| Clientes | `Users` | Lucide |
| Proyectos | `FolderKanban` | Lucide |
| Cotizadora | `FileText` | Lucide |
| Recepción | `TestTube` | Lucide |
| Verificación | `ClipboardList` | Lucide |
| Formato (Compresión) | `Beaker` | Lucide |
| Humedad | `Beaker` | Lucide |
| Control Laboratorio | `Activity` | Lucide |
| Control Comercial | `ClipboardList` | Lucide |
| Control Administración | `Shield` | Lucide |
| Usuarios | `Shield` | Lucide |
| Permisos | `Shield` | Lucide |
| Auditoría | `Activity` | Lucide |
| Configuración | `Settings` | Lucide |
| Seguimiento (Tracing) | `Activity` | Lucide |

---

## 6. Componentes UI

### 6.1 Librería base
- **Radix UI** — Primitivas accesibles (Dialog, Dropdown, Popover, Select, etc.)
- **shadcn/ui** — Componentes estilizados sobre Radix
- **Tailwind CSS v4** — Utility-first con theme tokens personalizados

### 6.2 Notificaciones
| Módulo | Librería | Estilo |
|---|---|---|
| CRM Shell (Next.js) | **Sonner** | Toast minimal |
| Compresión | **React Hot Toast** | Toast floating |
| Verificación | **Sonner** | Toast minimal |
| Recepción | **Sonner** | Toast minimal |

### 6.3 Radio de bordes
```
--radius: 0.5rem (8px)
  → sm: 4px
  → md: 6px
  → lg: 8px
  → xl: 12px
```

---

## 7. Layout del Dashboard

```
┌──────────────────────────────────────────────┐
│  ┌─────────┐  ┌──────────────────────────┐   │
│  │         │  │  Header (search, theme,  │   │
│  │ Sidebar │  │  notifications, avatar)  │   │
│  │  w-64   │  ├──────────────────────────┤   │
│  │         │  │                          │   │
│  │  Logo   │  │   Main Content Area      │   │
│  │  Nav    │  │   (overflow-auto p-6)    │   │
│  │  User   │  │                          │   │
│  │         │  │   Renders active module  │   │
│  └─────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────┘
```

- **Sidebar**: `w-64` fija, fondo `bg-sidebar`, borde derecho
- **Header**: Búsqueda global, theme toggle, notificaciones
- **Main**: `flex-1 overflow-auto p-6`
- **Contenedor root**: `flex h-screen bg-background`

---

## 8. Estados y Badges

| Estado | Color | Clase |
|---|---|---|
| Pendiente | Rojo/Naranja | `text-rose-500` / `bg-rose-50` |
| En Proceso | Amarillo/Ámbar | `text-amber-500` / `bg-amber-50` |
| Completado | Verde | `text-emerald-500` / `bg-emerald-50` |
| Conexión en Vivo | Verde dot | `bg-green-500 animate-pulse` |

### Status Chips (Card de recepción)
```
┌─────┬─────┬─────┐
│ REC │ VER │ COM │  ← Formato badges
└─────┴─────┴─────┘
  ✅     ✅    ❌     ← emerald si existe, slate si no
```

---

## 9. Login Screen

- Fondo: `login-background.png` con overlay oscuro
- Card central con logo + formulario
- Campos: Email + Password
- Botón primario: `bg-primary text-primary-foreground`
- Loader: `Loader2` con `animate-spin`

---

## 10. Arquitectura Visual (Micro-frontends)

| App | Framework | Puerto | Dominio Producción |
|---|---|---|---|
| CRM Shell | Next.js | 3000 | `crm.geofal.com.pe` |
| Cotizador | Vite/React | 5173 | `cotizador.geofal.com.pe` |
| API Backend | FastAPI | 8000 | `api.geofal.com.pe` |
| Recepción | Vite/React | — | iframe dentro del CRM |
| Verificación | Vite/React | — | iframe dentro del CRM |
| Compresión | Vite/React | — | iframe dentro del CRM |
| Programación | Next.js | — | iframe dentro del CRM |

Los micro-frontends se integran vía `<iframe>` dentro del shell principal, manteniendo cada uno su propio build y estilos.

---

## 11. Convenciones de Estilo

1. **Uppercase tracking**: Headers de tabla y badges usan `uppercase tracking-tighter` o `tracking-wider`.
2. **Font-black**: Títulos importantes usan `font-black` (peso 900).
3. **Colores funcionales**: Cada grupo de columnas tiene su color semántico asignado.
4. **Overflow-visible**: Contenedores con dropdowns/autocomplete deben usar `overflow-visible`.
5. **Sticky scrollbar**: Tablas anchas implementan scrollbar sticky sincronizado.
6. **Dark mode**: Soporte completo via CSS custom properties + `ThemeProvider`.
7. **Bordes suaves**: `border-gray-200` para cards, `border-gray-300` para celdas de tabla.
8. **Animaciones sutiles**: `transition-all duration-200` para hover states.

---

*Última actualización: Febrero 2026*
