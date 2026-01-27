# Cotizador Web - GEOFAL

Sistema de cotizaciones para servicios de laboratorio de suelos y agregados.

## 🚀 Características

- ✅ Autocompletado de ensayos con códigos relacionados
- ✅ Gestión de clientes y proyectos
- ✅ Condiciones específicas personalizables
- ✅ Plantillas reutilizables por vendedor
- ✅ Exportación a Excel
- ✅ Persistencia automática en localStorage
- ✅ Modo edición de cotizaciones existentes

## 📋 Requisitos

- Node.js 18+
- npm o yarn

## 🛠️ Instalación

```bash
# Clonar repositorio
git clone https://github.com/keviskibidi33-png/cotizador-frontend-new.git
cd cotizador-frontend-new

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar desarrollo
npm run dev
```

## 🔧 Variables de Entorno

```env
VITE_QUOTES_API_URL=https://api.geofal.com.pe
```

## 🐳 Docker

```bash
# Build
docker build -t cotizador-web .

# Run
docker run -p 80:80 cotizador-web
```

## 📦 Producción

```bash
npm run build
```

Los archivos se generan en `dist/`.

## 🔗 Integración

El cotizador recibe parámetros por URL:
- `user_id` - ID del vendedor
- `email` - Correo del vendedor
- `name` - Nombre del vendedor
- `phone` - Teléfono del vendedor
- `quote_id` - (Opcional) ID para editar cotización existente

Ejemplo:
```
https://cotizador.geofal.com.pe/?user_id=123&email=vendedor@geofal.com&name=Juan%20Perez&phone=999888777
```

## 📄 API Backend

Requiere el backend de cotizaciones:
- Repositorio: `api-geofal-crm`
- Endpoints: `/quotes`, `/clientes`, `/proyectos`, `/condiciones`, `/plantillas`

## 🏗️ Estructura

```
src/
├── components/ui/    # Componentes reutilizables
├── data/            # Datos de ensayos
├── lib/             # Utilidades
└── pages/           # Páginas principales
```

## 📝 Licencia

Privado - GEOFAL © 2026
