# 🔌 API Geofal CRM - Servicio de Cotizaciones

API REST para generación y gestión de cotizaciones del sistema CRM Geofal.

## 🚀 Quick Start

```bash
# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
uvicorn app.main:app --reload --port 8000

# Con Docker
docker build -t api-geofal-crm .
docker run -p 8000:8000 --env-file .env api-geofal-crm
```

## 📋 Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `QUOTES_DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | URL de proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service Role Key para Storage |
| `QUOTES_CORS_ORIGINS` | ❌ | Orígenes CORS permitidos (default: `*`) |
| `QUOTES_DISABLE_DB` | ❌ | Deshabilitar conexión DB (`true/false`) |

## 🔗 Endpoints

### Health & Debug

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Estado del servicio |
| GET | `/debug-db` | Diagnóstico de DB |

### Cotizaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/export` | Genera XLSX de cotización |
| POST | `/export/xlsx` | Alias de `/export` |
| GET | `/quotes` | Lista cotizaciones |
| GET | `/quotes/{id}/download` | Descarga archivo |
| DELETE | `/quotes/{id}` | Elimina cotización |
| POST | `/quote/next-number` | Siguiente número secuencial |

### Clientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/clientes?search=` | Buscar clientes |
| POST | `/clientes` | Crear cliente |

### Proyectos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/proyectos?cliente_id=&search=` | Listar proyectos |
| POST | `/proyectos` | Crear proyecto |

## 📝 Ejemplo: Crear Cotización

```bash
curl -X POST http://localhost:8000/export \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "EMPRESA SAC",
    "ruc": "20123456789",
    "contacto": "Juan Pérez",
    "telefono_contacto": "999888777",
    "correo": "juan@empresa.com",
    "proyecto": "Obra Centro Comercial",
    "ubicacion": "Lima, Perú",
    "personal_comercial": "Carlos López",
    "telefono_comercial": "999111222",
    "include_igv": true,
    "igv_rate": 0.18,
    "template_id": "V1",
    "items": [
      {
        "codigo": "SC-001",
        "descripcion": "Análisis Granulométrico por Tamizado",
        "norma": "NTP 339.128",
        "acreditado": "SI",
        "costo_unitario": 45.00,
        "cantidad": 5
      }
    ]
  }' --output cotizacion.xlsx
```

## 📁 Estructura del Proyecto

```
api-geofal-crm/
├── app/
│   ├── __init__.py
│   ├── main.py              # Endpoints FastAPI
│   ├── database.py          # Conexión SQLAlchemy
│   ├── xlsx_direct.py       # Exportador XLSX legacy
│   └── xlsx_direct_v2.py    # Exportador XLSX XML
├── cotizaciones/            # Archivos generados (local)
│   └── {year}/              # Organizados por año
├── Formato-cotizacion.xlsx  # Template default
├── V1 - MUESTRA DE SUELO... # Templates adicionales
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## 🎨 Plantillas

| ID | Nombre | Archivo |
|----|--------|---------|
| V1 | Muestra de Suelo y Agregado | `V1 - MUESTRA DE SUELO Y AGREGADO.xlsx` |
| V2 | Probetas | `V2 - PROBETAS.xlsx` |
| V3 | Densidad de Campo y Muestreo | `V3 - DENSIDAD DE CAMPO Y MUESTREO.xlsx` |
| V4 | Extracción de Diamantina | `V4 - EXTRACCIÓN DE DIAMANTINA.xlsx` |
| V5 | Diamantina para Pases | `V5 - DIAMANTINA PARA PASES.xlsx` |
| V6 | Albañilería | `V6 - ALBAÑILERÍA.xlsx` |
| V7 | Viga Beckelman | `V7 - VIGA BECKELMAN.xlsx` |
| V8 | Control de Calidad de Concreto | `V8 - CONTROL DE CALIDAD DE CONCRETO FRESCO EN OBRA.xlsx` |

## 🗄️ Base de Datos

La API espera las siguientes tablas:

- `cotizaciones` - Registro de cotizaciones
- `clientes` - Catálogo de clientes
- `proyectos` - Proyectos por cliente
- `vendedores` - Usuarios del sistema
- `quote_sequences` - Numeración secuencial

Ver `DOCUMENTATION.md` en el proyecto raíz para esquemas completos.

## 🐳 Docker

```bash
# Build
docker build -t api-geofal-crm .

# Run
docker run -d \
  --name api-geofal-crm \
  -p 8000:8000 \
  -e QUOTES_DATABASE_URL="postgresql://..." \
  -e SUPABASE_URL="https://..." \
  -e SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  api-geofal-crm
```

## 📄 Licencia

Propietario - GEOFAL Laboratorios
