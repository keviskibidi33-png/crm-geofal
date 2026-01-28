-- Migración: Sistema de Control de Programación de Servicios
-- Módulo colaborativo entre LABORATORIO, COMERCIAL y ADMINISTRACIÓN

-- =====================================================
-- ACTUALIZAR ROLES EN VENDEDORES
-- =====================================================
-- Los roles posibles ahora son: 'admin', 'vendor', 'laboratorio', 'comercial', 'administracion'
-- No necesitamos ALTER porque role es TEXT sin CHECK constraint

-- =====================================================
-- TABLA PRINCIPAL DE PROGRAMACIÓN
-- =====================================================
CREATE TABLE IF NOT EXISTS programacion_servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificadores principales (se crean en LABORATORIO, se propagan a otras hojas)
    item_numero SERIAL,  -- Número de ítem secuencial
    recep_numero VARCHAR(20) NOT NULL,  -- Ej: "136-26", "137-26"
    
    -- =====================================================
    -- SECCIÓN LABORATORIO
    -- =====================================================
    ot VARCHAR(20),  -- Orden de trabajo: "138-26 LEM"
    codigo_muestra TEXT,  -- Puede ser múltiples: "356-SU-26, 357-SU-26 AL 362-SU-26"
    fecha_recepcion DATE,
    fecha_inicio DATE,
    fecha_entrega_estimada DATE,
    cliente_nombre VARCHAR(255),
    descripcion_servicio TEXT,  -- "DENSIDAD / LUIS 6 PUNTOS"
    proyecto VARCHAR(255),
    entrega_real DATE,
    estado_trabajo VARCHAR(50) DEFAULT 'PROCESO',  -- PROCESO, COMPLETADO, PENDIENTE
    cotizacion_lab VARCHAR(50),  -- "COTIZACIÓN-059-26"
    autorizacion_lab VARCHAR(50),  -- "ENTREGAR", "NO ENTREGAR"
    nota_lab TEXT,
    dias_atraso_lab INTEGER DEFAULT 0,
    motivo_dias_atraso_lab TEXT,
    evidencia_envio_recepcion BOOLEAN DEFAULT FALSE,
    envio_informes BOOLEAN DEFAULT FALSE,
    
    -- =====================================================
    -- SECCIÓN COMERCIAL
    -- =====================================================
    fecha_solicitud_com DATE,
    fecha_entrega_com DATE,
    evidencia_solicitud_envio VARCHAR(10) DEFAULT 'NO',  -- 'SI', 'NO'
    dias_atraso_envio_coti INTEGER DEFAULT 0,
    motivo_dias_atraso_com TEXT,
    
    -- =====================================================
    -- SECCIÓN ADMINISTRACIÓN
    -- =====================================================
    numero_factura VARCHAR(50),  -- "F001-4550"
    estado_pago VARCHAR(50),  -- "PAGADO", "PENDIENTE", null
    estado_autorizar VARCHAR(50),  -- "ENTREGAR", "NO ENTREGAR"
    nota_admin TEXT,
    
    -- Metadatos
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    activo BOOLEAN DEFAULT TRUE
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_prog_recep ON programacion_servicios(recep_numero);
CREATE INDEX IF NOT EXISTS idx_prog_cliente ON programacion_servicios(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_prog_estado ON programacion_servicios(estado_trabajo);
CREATE INDEX IF NOT EXISTS idx_prog_fecha_recep ON programacion_servicios(fecha_recepcion);
CREATE INDEX IF NOT EXISTS idx_prog_cotizacion ON programacion_servicios(cotizacion_lab);
CREATE INDEX IF NOT EXISTS idx_prog_item ON programacion_servicios(item_numero);

-- =====================================================
-- HISTORIAL DE CAMBIOS PARA AUDITORÍA
-- =====================================================
CREATE TABLE IF NOT EXISTS programacion_servicios_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programacion_id UUID REFERENCES programacion_servicios(id) ON DELETE CASCADE,
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    seccion VARCHAR(20),  -- 'LABORATORIO', 'COMERCIAL', 'ADMINISTRACION'
    modificado_por UUID REFERENCES auth.users(id),
    modificado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_prog ON programacion_servicios_historial(programacion_id);
CREATE INDEX IF NOT EXISTS idx_hist_fecha ON programacion_servicios_historial(modificado_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE programacion_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE programacion_servicios_historial ENABLE ROW LEVEL SECURITY;

-- Políticas para programacion_servicios
DROP POLICY IF EXISTS "Usuarios pueden ver programacion" ON programacion_servicios;
CREATE POLICY "Usuarios pueden ver programacion"
    ON programacion_servicios FOR SELECT
    TO authenticated
    USING (activo = true);

DROP POLICY IF EXISTS "Usuarios pueden crear programacion" ON programacion_servicios;
CREATE POLICY "Usuarios pueden crear programacion"
    ON programacion_servicios FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios pueden actualizar programacion" ON programacion_servicios;
CREATE POLICY "Usuarios pueden actualizar programacion"
    ON programacion_servicios FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Políticas para historial
DROP POLICY IF EXISTS "Usuarios pueden ver historial" ON programacion_servicios_historial;
CREATE POLICY "Usuarios pueden ver historial"
    ON programacion_servicios_historial FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Usuarios pueden crear historial" ON programacion_servicios_historial;
CREATE POLICY "Usuarios pueden crear historial"
    ON programacion_servicios_historial FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =====================================================
-- TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_programacion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_programacion_updated ON programacion_servicios;
CREATE TRIGGER trigger_programacion_updated
    BEFORE UPDATE ON programacion_servicios
    FOR EACH ROW
    EXECUTE FUNCTION update_programacion_updated_at();

-- =====================================================
-- FUNCIÓN PARA GENERAR PRÓXIMO RECEP_NUMERO
-- =====================================================
CREATE OR REPLACE FUNCTION generar_recep_numero()
RETURNS VARCHAR(20) AS $$
DECLARE
    anio_actual VARCHAR(2);
    ultimo_numero INTEGER;
    nuevo_numero INTEGER;
BEGIN
    anio_actual := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SPLIT_PART(recep_numero, '-', 1) AS INTEGER)), 0)
    INTO ultimo_numero
    FROM programacion_servicios
    WHERE recep_numero LIKE '%-' || anio_actual;
    
    nuevo_numero := ultimo_numero + 1;
    
    RETURN nuevo_numero::VARCHAR || '-' || anio_actual;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN PARA GENERAR PRÓXIMO OT
-- =====================================================
CREATE OR REPLACE FUNCTION generar_ot_numero()
RETURNS VARCHAR(20) AS $$
DECLARE
    anio_actual VARCHAR(2);
    ultimo_numero INTEGER;
    nuevo_numero INTEGER;
BEGIN
    anio_actual := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SPLIT_PART(SPLIT_PART(ot, '-', 1), ' ', 1) AS INTEGER)), 0)
    INTO ultimo_numero
    FROM programacion_servicios
    WHERE ot LIKE '%-' || anio_actual || ' LEM';
    
    nuevo_numero := ultimo_numero + 1;
    
    RETURN nuevo_numero::VARCHAR || '-' || anio_actual || ' LEM';
END;
$$ LANGUAGE plpgsql;
