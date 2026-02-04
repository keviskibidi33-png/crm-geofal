-- =========================================================
-- SCRIPT DE CONFIGURACIÓN RLS PARA GEOFAL CRM
-- Propósito: Activar seguridad por filas compatible con roles
-- =========================================================

-- 1. Función para obtener el rol del usuario autenticado de forma eficiente
DROP FUNCTION IF EXISTS public.get_my_role();

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.perfiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Habilitar RLS en las tablas críticas
ALTER TABLE public.programacion_lab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacion_comercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacion_administracion ENABLE ROW LEVEL SECURITY;

-- 3. ELIMINAR POLÍTICAS EXISTENTES (Para limpieza si se re-ejecuta)
DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_lab;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_comercial;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_administracion;
DROP POLICY IF EXISTS "Permitir escritura a roles operativos" ON public.programacion_lab;
DROP POLICY IF EXISTS "Permitir escritura a roles comerciales" ON public.programacion_comercial;
DROP POLICY IF EXISTS "Permitir escritura a roles administrativos" ON public.programacion_administracion;

-- ==========================================
-- POLÍTICAS DE LECTURA (SELECT)
-- ==========================================

CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_lab FOR SELECT
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'laboratorio_lector', 'vendor'));

CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_comercial FOR SELECT
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'laboratorio_lector', 'vendor'));

CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_administracion FOR SELECT
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'laboratorio_lector', 'vendor'));

-- ==========================================
-- POLÍTICAS DE ESCRITURA (INSERT/UPDATE/DELETE)
-- ==========================================

-- A. Laboratorio: Todos menos Lector
CREATE POLICY "Permitir escritura a roles operativos"
ON public.programacion_lab FOR ALL
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'vendor'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'vendor'));

-- B. Comercial: Admin, Administrativo y Vendor
CREATE POLICY "Permitir escritura a roles comerciales"
ON public.programacion_comercial FOR ALL
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo', 'vendor'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo', 'vendor'));

-- C. Administración: Solo Admin y Administrativo
CREATE POLICY "Permitir escritura a roles administrativos"
ON public.programacion_administracion FOR ALL
TO authenticated
USING (get_my_role() IN ('admin', 'administrativo'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo'));

-- =========================================================
-- NOTA: Estas políticas asumen que el Front-end ya maneja 
-- la lógica de visibilidad, pero el RLS actúa como el 
-- guardián final en la base de datos.
-- =========================================================
