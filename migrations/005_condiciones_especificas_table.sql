-- Crear tabla para condiciones específicas de cotizaciones
CREATE TABLE IF NOT EXISTS condiciones_especificas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto TEXT NOT NULL,
    categoria VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_condiciones_activo ON condiciones_especificas(activo);
CREATE INDEX idx_condiciones_categoria ON condiciones_especificas(categoria);
CREATE INDEX idx_condiciones_orden ON condiciones_especificas(orden);

-- RLS Policies
ALTER TABLE condiciones_especificas ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer condiciones activas
CREATE POLICY "Usuarios pueden ver condiciones activas"
    ON condiciones_especificas
    FOR SELECT
    TO authenticated
    USING (activo = true);

-- Solo usuarios autenticados pueden crear condiciones
CREATE POLICY "Usuarios pueden crear condiciones"
    ON condiciones_especificas
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Los usuarios pueden actualizar condiciones que crearon
CREATE POLICY "Usuarios pueden actualizar sus condiciones"
    ON condiciones_especificas
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_condiciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_condiciones_updated_at
    BEFORE UPDATE ON condiciones_especificas
    FOR EACH ROW
    EXECUTE FUNCTION update_condiciones_updated_at();

-- Insertar condiciones iniciales desde el CSV
INSERT INTO condiciones_especificas (texto, orden, activo) VALUES
('El cliente proporcionara al laboratorio para realizar el ensayo de suelo y/o agregados la cantidad mínima de 100 kg por cada muestra.', 1, true),
('El cliente deberá de entregar las muestras debidamente identificadas.', 2, true),
('El cliente deberá especificar la Norma a ser utilizada para la ejecución del ensayo, caso contrario se considera Norma ASTM o NTP vigente de acuerdo con el alcance del laboratorio.', 3, true),
('El cliente deberá entregar las muestras en las instalaciones del LEM, ubicado en la Av. Marañón N° 763, Los Olivos, Lima.', 4, true),
('El cliente proporcionara al laboratorio para realizar el diseño de mezcla de concreto la cantidad mínima de 70 kg de agregado grueso, 70 kg de agregado fino, 01 bolsa de cemento y 1 litro aditivo.', 5, true),
('La emisión de informes de ensayo con acreditación INACAL se realizará solo si la fuerza de falla de la probeta está dentro del rango de 50 kN a 800 kN.', 6, true),
('Para programar el ensayo de densidad de campo, la cantidad mínima de puntos por salida es de cuatro (4).', 7, true),
('El cliente deberá de programar el servicio, Densidad de campo, con 24 horas de anticipación.', 8, true),
('El servicio de Densidad en campo es por 01 día.', 9, true),
('El servicio no incluye trabajos de acabados como pintura, mayolica y otros.', 10, true),
('La extracción de diamantina se realizara en 2 dias en campo, en laboratorio se realizará el ensayo de compresión de testigo de diamantino dentro de 5 dias una vez tallado (Este tiempo obedece a la normativa vigente).', 11, true),
('El area de trabajo, zona de extracción de diamantina, tiene que estar libre de interferencia.', 12, true),
('El cliente deberá de programar el servicio, con 48 horas de anticipación.', 13, true),
('El area de trabajo, debera estar habilitado y libre de interferencia.', 14, true),
('El cliente deberá proporcionar al laboratorio 15 unidades de ladrillo por cada tipo de muestra, asegurándose de que estén en buen estado y sin fisuras.', 15, true),
('Para el ensayo de control de calidad de concreto fresco en obra, se moldeara 6 probetas, ensayo slump, control de temperatura, en laboratorio las probetas se colocara en camara de curado, el ensayo de compresión de las probetas seran 3 a 7 dias y 3 a 28 dias.', 16, true);

COMMENT ON TABLE condiciones_especificas IS 'Almacena las condiciones específicas reutilizables para cotizaciones';
COMMENT ON COLUMN condiciones_especificas.texto IS 'Texto de la condición (sin el guión inicial)';
COMMENT ON COLUMN condiciones_especificas.categoria IS 'Categoría opcional para agrupar condiciones';
COMMENT ON COLUMN condiciones_especificas.orden IS 'Orden de visualización sugerido';
