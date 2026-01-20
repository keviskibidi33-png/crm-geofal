# Cotizador Geofal - Quote Builder

Sistema de generación de cotizaciones para Geofal, construido con React, Vite y TypeScript.

## 🚀 Características

- **Generación de Cotizaciones**: Crea cotizaciones profesionales en formato Excel
- **Múltiples Plantillas**: Soporte para diferentes tipos de servicios (V1-V8)
- **Integración con CRM**: Conecta con clientes y proyectos del CRM
- **Descarga Automática**: Genera y descarga archivos Excel con formato personalizado
- **Cálculo de IGV**: Incluye/excluye IGV automáticamente

## 📋 Requisitos Previos

- Node.js 20 o superior
- npm
- Backend API (quotes-service) corriendo

## 🛠️ Instalación Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar .env con la URL del backend
# VITE_QUOTES_API_URL=http://localhost:8000

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🐳 Despliegue con Docker

### Build local
```bash
docker build -t cotizador-geofal \
  --build-arg VITE_QUOTES_API_URL=https://api.geofal.com.pe \
  .
```

### Ejecutar contenedor
```bash
docker run -p 80:80 cotizador-geofal
```

## ☁️ Despliegue en Coolify

1. Crear nuevo proyecto en Coolify
2. Conectar este repositorio
3. Configurar build args:
   - `VITE_QUOTES_API_URL=https://api.geofal.com.pe`
4. Configurar dominio: `cotizador.geofal.com.pe`
5. Deploy

Coolify detectará automáticamente el `Dockerfile` y configurará Traefik para HTTPS.

## 🔧 Tecnologías

- **Framework**: React 18 + Vite 5
- **UI**: Radix UI + Tailwind CSS
- **HTTP Client**: Fetch API
- **Build Tool**: Vite
- **Server**: Nginx (producción)

## 📁 Estructura del Proyecto

```
cotizador-web/
├── src/
│   ├── components/     # Componentes React
│   ├── pages/          # Páginas principales
│   ├── lib/            # Utilidades
│   └── main.tsx        # Entry point
├── public/             # Archivos estáticos
├── Dockerfile          # Configuración Docker
└── vite.config.ts      # Configuración Vite
```

## 🔗 Integración con CRM

El cotizador se integra con el CRM a través del backend API:

- **Clientes**: Obtiene lista de clientes desde `/clientes`
- **Proyectos**: Obtiene proyectos por cliente desde `/proyectos`
- **Numeración**: Obtiene siguiente número de cotización desde `/quote/next-number`
- **Generación**: Envía datos a `/export/xlsx` para generar Excel

## 🔐 Variables de Entorno

### Build-time (Vite)
- `VITE_QUOTES_API_URL`: URL del backend API

## 📝 Licencia

Propietario - Geofal
