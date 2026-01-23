-- ============================================================
-- MIGRACIÓN: Tabla Contactos y Vinculación con Proyectos
-- Fecha: 2026-01-22
-- Descripción: Implementa la Opción B para confidencialidad
-- ============================================================

-- 1. Crear tabla de contactos
-- (Cada empresa puede tener múltiples contactos)
CREATE TABLE IF NOT EXISTS public.contactos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text,
  telefono text,
  cargo text,
  es_principal boolean DEFAULT false,
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índice para búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_contactos_cliente_id ON public.contactos(cliente_id);

-- 2. Agregar columna de contacto principal a proyectos
-- (Vincula el proyecto con el contacto específico con quien se negoció)
ALTER TABLE public.proyectos 
ADD COLUMN IF NOT EXISTS contacto_principal_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL;

-- 3. Agregar tipo de documento a clientes para distinguir RUC de DNI
-- (El campo 'ruc' ya existe y soporta ambos, pero agregamos un tipo para claridad)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'RUC' CHECK (tipo_documento IN ('RUC', 'DNI', 'CE', 'OTRO'));

-- 4. Migrar datos existentes: crear contactos a partir de datos en clientes
-- (Esto toma el 'nombre' del cliente como primer contacto)
INSERT INTO public.contactos (cliente_id, nombre, email, telefono, cargo, es_principal)
SELECT 
  id as cliente_id,
  nombre,
  email,
  telefono,
  'Contacto Principal' as cargo,
  true as es_principal
FROM public.clientes
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 5. Habilitar RLS para la tabla contactos
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden ver todos los contactos
CREATE POLICY "Usuarios autenticados pueden ver contactos" 
ON public.contactos FOR SELECT 
TO authenticated 
USING (true);

-- Política: Usuarios autenticados pueden insertar contactos
CREATE POLICY "Usuarios autenticados pueden insertar contactos" 
ON public.contactos FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política: Usuarios autenticados pueden actualizar contactos
CREATE POLICY "Usuarios autenticados pueden actualizar contactos" 
ON public.contactos FOR UPDATE 
TO authenticated 
USING (true);

-- Política: Usuarios autenticados pueden eliminar contactos
CREATE POLICY "Usuarios autenticados pueden eliminar contactos" 
ON public.contactos FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================
-- COMENTARIOS FINALES
-- ============================================================
-- Después de ejecutar esta migración:
-- 1. Cada cliente tendrá un contacto principal creado automáticamente
-- 2. Los proyectos pueden vincularse a un contacto específico
-- 3. Se puede agregar múltiples contactos por cliente
-- 4. La tabla 'clientes' ahora tiene 'tipo_documento' para RUC/DNI
