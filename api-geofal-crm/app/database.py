"""
Database module for shared PostgreSQL connection with Directus.
Both Directus and this cotizador service use the same database.
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

# Database configuration from environment variables
DB_USER = os.getenv('DB_USER', 'directus')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'directus')
DB_HOST = os.getenv('DB_HOST', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_DATABASE = os.getenv('DB_DATABASE', 'directus')

# Build connection URL (fallback to QUOTES_DATABASE_URL if set)
DATABASE_URL = os.getenv('QUOTES_DATABASE_URL') or \
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_DATABASE}"

# Create engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db():
    """Context manager for database sessions."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_cotizaciones_table():
    """
    Initialize the cotizaciones table if it doesn't exist.
    Note: In production, Directus should create this table via its UI.
    This is just a fallback for development.
    """
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(20) NOT NULL,
                year INTEGER NOT NULL,
                
                -- Cliente info (puede ser relación M2O con directus_users o tabla clientes)
                cliente_nombre VARCHAR(255),
                cliente_ruc VARCHAR(20),
                cliente_contacto VARCHAR(255),
                cliente_telefono VARCHAR(50),
                cliente_email VARCHAR(255),
                
                -- Proyecto info
                proyecto VARCHAR(255),
                ubicacion VARCHAR(255),
                
                -- Comercial
                personal_comercial VARCHAR(255),
                telefono_comercial VARCHAR(50),
                
                -- Fechas
                fecha_solicitud DATE,
                fecha_emision DATE,
                
                -- Totales
                subtotal DECIMAL(12,2) DEFAULT 0,
                igv DECIMAL(12,2) DEFAULT 0,
                total DECIMAL(12,2) DEFAULT 0,
                include_igv BOOLEAN DEFAULT true,
                
                -- Estado y metadata
                estado VARCHAR(20) DEFAULT 'borrador',
                moneda VARCHAR(10) DEFAULT 'PEN',
                
                -- Archivo generado
                archivo_path VARCHAR(500),
                
                -- JSON con items detallados
                items_json JSONB,
                
                -- Timestamps
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Unique constraint
                UNIQUE(year, numero)
            )
        """))
        conn.commit()


def guardar_cotizacion(data: dict) -> int:
    """
    Save a quote to the database.
    Returns the ID of the saved quote.
    """
    with engine.connect() as conn:
        result = conn.execute(text("""
            INSERT INTO cotizaciones (
                numero, year, cliente_nombre, cliente_ruc, cliente_contacto,
                cliente_telefono, cliente_email, proyecto, ubicacion,
                personal_comercial, telefono_comercial, fecha_solicitud,
                fecha_emision, subtotal, igv, total, include_igv,
                estado, archivo_path, items_json
            ) VALUES (
                :numero, :year, :cliente_nombre, :cliente_ruc, :cliente_contacto,
                :cliente_telefono, :cliente_email, :proyecto, :ubicacion,
                :personal_comercial, :telefono_comercial, :fecha_solicitud,
                :fecha_emision, :subtotal, :igv, :total, :include_igv,
                :estado, :archivo_path, :items_json
            )
            ON CONFLICT (year, numero) DO UPDATE SET
                cliente_nombre = EXCLUDED.cliente_nombre,
                cliente_ruc = EXCLUDED.cliente_ruc,
                cliente_contacto = EXCLUDED.cliente_contacto,
                cliente_telefono = EXCLUDED.cliente_telefono,
                cliente_email = EXCLUDED.cliente_email,
                proyecto = EXCLUDED.proyecto,
                ubicacion = EXCLUDED.ubicacion,
                personal_comercial = EXCLUDED.personal_comercial,
                telefono_comercial = EXCLUDED.telefono_comercial,
                fecha_solicitud = EXCLUDED.fecha_solicitud,
                fecha_emision = EXCLUDED.fecha_emision,
                subtotal = EXCLUDED.subtotal,
                igv = EXCLUDED.igv,
                total = EXCLUDED.total,
                include_igv = EXCLUDED.include_igv,
                archivo_path = EXCLUDED.archivo_path,
                items_json = EXCLUDED.items_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """), data)
        row = result.fetchone()
        conn.commit()
        return row[0] if row else None


def listar_cotizaciones(year: int = None, limit: int = 50) -> list:
    """List quotes from database."""
    with engine.connect() as conn:
        if year:
            result = conn.execute(text("""
                SELECT id, numero, year, cliente_nombre, cliente_ruc, proyecto,
                       total, estado, moneda, fecha_emision, archivo_path, created_at
                FROM cotizaciones
                WHERE year = :year
                ORDER BY created_at DESC
                LIMIT :limit
            """), {"year": year, "limit": limit})
        else:
            result = conn.execute(text("""
                SELECT id, numero, year, cliente_nombre, cliente_ruc, proyecto,
                       total, estado, moneda, fecha_emision, archivo_path, created_at
                FROM cotizaciones
                ORDER BY created_at DESC
                LIMIT :limit
            """), {"limit": limit})
        
        columns = result.keys()
        return [dict(zip(columns, row)) for row in result.fetchall()]


def obtener_cotizacion(quote_id: int) -> dict:
    """Get a single quote by ID."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT * FROM cotizaciones WHERE id = :id
        """), {"id": quote_id})
        row = result.fetchone()
        if row:
            columns = result.keys()
            return dict(zip(columns, row))
        return None


def eliminar_cotizacion(quote_id: int) -> bool:
    """Delete a quote by ID."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            DELETE FROM cotizaciones WHERE id = :id RETURNING id
        """), {"id": quote_id})
        conn.commit()
        return result.fetchone() is not None
