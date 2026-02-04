-- =========================================================
-- SCRIPT DE AJUSTE RLS (COMPATIBILIDAD CON IFRAME ANON)
-- Propósito: Corregir errores 401/406 permitiendo lectura pública
-- pero manteniendo protección de escritura.
-- =========================================================

-- 1. Asegurar que las tablas de sistema permitan lectura pública (Fix 406)
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica de roles" ON public.role_definitions;
CREATE POLICY "Lectura publica de roles" ON public.role_definitions FOR SELECT TO public USING (true);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica de perfiles" ON public.perfiles;
CREATE POLICY "Lectura publica de perfiles" ON public.perfiles FOR SELECT TO public USING (true);

-- 2. Actualizar políticas de las tablas de programación (Fix 401)
-- IMPORTANTE: Cambiamos 'TO authenticated' por 'TO public' para que el Iframe pueda leer.

-- A. LECTURA (SELECT): Permitida para todos (Igual que antes de activar RLS)
DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_lab;
CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_lab FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_comercial;
CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_comercial FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Permitir lectura a usuarios autorizados" ON public.programacion_administracion;
CREATE POLICY "Permitir lectura a usuarios autorizados"
ON public.programacion_administracion FOR SELECT
TO public
USING (true);

-- B. ESCRITURA (INSERT/UPDATE/DELETE): Mantener restricción de ROL
-- Nota: Si el usuario es ANON, get_my_role() devolverá NULL y la política lo bloqueará.
-- Esto protege contra ediciones malintencionadas sin token válido.

DROP POLICY IF EXISTS "Permitir escritura a roles operativos" ON public.programacion_lab;
CREATE POLICY "Permitir escritura a roles operativos"
ON public.programacion_lab FOR ALL
TO public
USING (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'vendor'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo', 'laboratorio_tipificador', 'vendor'));

DROP POLICY IF EXISTS "Permitir escritura a roles comerciales" ON public.programacion_comercial;
CREATE POLICY "Permitir escritura a roles comerciales"
ON public.programacion_comercial FOR ALL
TO public
USING (get_my_role() IN ('admin', 'administrativo', 'vendor'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo', 'vendor'));

DROP POLICY IF EXISTS "Permitir escritura a roles administrativos" ON public.programacion_administracion;
CREATE POLICY "Permitir escritura a roles administrativos"
ON public.programacion_administracion FOR ALL
TO public
USING (get_my_role() IN ('admin', 'administrativo'))
WITH CHECK (get_my_role() IN ('admin', 'administrativo'));

-- 3. Verificación de la función get_my_role()
-- Nos aseguramos que sea SECURITY DEFINER para que pueda leer 'perfiles' incluso con RLS.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  -- Usamos auth.uid() para detectar al usuario autenticado via JWT
  SELECT role FROM public.perfiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
