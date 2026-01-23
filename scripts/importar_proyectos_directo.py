"""
Script para importar proyectos directamente a Supabase
Vincula proyectos a clientes existentes por RUC
"""

import os
import re
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan variables de entorno")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

DEFAULT_VENDEDOR_ID = "7818ac9d-f7c0-4540-bb32-e04d7423652c"


def limpiar_documento(valor):
    """Limpia RUC/DNI"""
    if pd.isna(valor) or valor is None or str(valor).strip() in ['-', '', 'nan']:
        return ""
    
    doc = str(valor).strip()
    
    if 'e' in doc.lower() or 'E' in doc:
        try:
            doc = str(int(float(doc)))
        except:
            pass
    
    doc = re.sub(r'[^\d]', '', doc)
    return doc if len(doc) >= 8 else ""


def limpiar_texto(valor):
    """Limpia texto"""
    if pd.isna(valor) or valor is None:
        return None
    
    texto = str(valor).strip()
    
    if texto in ['-', '--', '.', '', 'N/A', 'n/a', 'NA', 'na', 'S/D', 's/d', 'nan', 'NaN']:
        return None
    
    return texto


print("=" * 60)
print("🚀 IMPORTACIÓN DE PROYECTOS A SUPABASE")
print("=" * 60)

# Leer CSV
archivo = r'c:\Users\Lenovo\Documents\crmnew\proyectosporruc.csv'
print(f"\n📂 Leyendo: {archivo}")

df = None
for enc in ['latin-1', 'utf-8', 'cp1252']:
    for sep in [';', ',', '\t']:
        try:
            df_temp = pd.read_csv(archivo, encoding=enc, sep=sep, on_bad_lines='skip')
            if len(df_temp.columns) > 1:
                df = df_temp
                print(f"✅ Leído con encoding={enc}, separador='{sep}'")
                break
        except:
            continue
    if df is not None:
        break

if df is None:
    raise Exception("No se pudo leer el archivo CSV")

print(f"📊 Filas originales: {len(df)}")
print(f"📋 Columnas: {list(df.columns)}")

# Detectar columnas
df_cols_upper = [str(c).strip().upper() for c in df.columns]
col_map = {c.upper(): c for c in df.columns}

col_ruc = col_map.get('RUC') or col_map.get('DNI')
col_proyecto = col_map.get('PROYECTO') or col_map.get('NOMBRE') or col_map.get('OBRA')
col_ubicacion = col_map.get('UBICACIÓN') or col_map.get('UBICACION') or col_map.get('DIRECCION')

print(f"\n🔍 Mapeo de columnas:")
print(f"   RUC: {col_ruc}")
print(f"   Proyecto: {col_proyecto}")
print(f"   Ubicación: {col_ubicacion}")

if not col_ruc or not col_proyecto:
    raise Exception("Faltan columnas esenciales (RUC, PROYECTO)")

# Filtrar filas con datos válidos
print("\n🧹 Limpiando datos...")
df_antes = len(df)
df = df[df[col_proyecto].notna()]
df = df[df[col_proyecto].astype(str).str.strip() != '']
df = df[df[col_proyecto].astype(str).str.strip() != '-']
df = df[df[col_ruc].notna()]
print(f"   Eliminados: {df_antes - len(df)} registros vacíos/inválidos")
print(f"   Total a procesar: {len(df)}")

# Insertar proyectos
print("\n📤 Insertando proyectos en Supabase...")
proyectos_creados = 0
proyectos_existentes = 0
sin_cliente = 0
errores = 0

for idx, row in df.iterrows():
    try:
        documento = limpiar_documento(row[col_ruc])
        if not documento:
            sin_cliente += 1
            continue
        
        proyecto_nombre = limpiar_texto(row[col_proyecto])
        if not proyecto_nombre:
            continue
        
        ubicacion = limpiar_texto(row[col_ubicacion]) if col_ubicacion else None
        
        # Buscar cliente por RUC
        cliente = supabase.table("clientes").select("id").eq("ruc", documento).execute()
        
        if not cliente.data or len(cliente.data) == 0:
            sin_cliente += 1
            if sin_cliente <= 10:
                print(f"⚠️  Fila {idx+2}: Cliente no encontrado con RUC {documento}")
            continue
        
        cliente_id = cliente.data[0]["id"]
        
        # Buscar contacto principal
        contacto = supabase.table("contactos").select("id").eq("cliente_id", cliente_id).eq("es_principal", True).execute()
        contacto_id = contacto.data[0]["id"] if contacto.data and len(contacto.data) > 0 else None
        
        # Verificar si proyecto existe
        existing = supabase.table("proyectos").select("id").eq("cliente_id", cliente_id).eq("nombre", proyecto_nombre).execute()
        
        if existing.data and len(existing.data) > 0:
            proyectos_existentes += 1
            if idx % 100 == 0:
                print(f"   Procesando... {idx}/{len(df)}")
            continue
        
        # Crear proyecto
        proyecto_data = {
            "cliente_id": cliente_id,
            "vendedor_id": DEFAULT_VENDEDOR_ID,
            "nombre": proyecto_nombre,
            "ubicacion": ubicacion,
            "estado": "prospecto",  # Valores válidos: prospecto, en_negociacion, venta_ganada, etc.
            "etapa": "inicial",
            "presupuesto": 0,
            "progreso": 0,
            "contacto_principal_id": contacto_id
        }
        
        supabase.table("proyectos").insert(proyecto_data).execute()
        proyectos_creados += 1
        
        if proyectos_creados % 50 == 0 or idx % 100 == 0:
            print(f"   ✅ {proyectos_creados} proyectos creados ({idx}/{len(df)} procesados)")
        
        # Actualizar contador de proyectos del cliente
        if proyectos_creados % 50 == 0:
            total_proyectos = supabase.table("proyectos").select("id", count="exact").eq("cliente_id", cliente_id).eq("deleted_at", None).execute()
            supabase.table("clientes").update({"proyectos": total_proyectos.count or 0}).eq("id", cliente_id).execute()
        
    except Exception as e:
        errores += 1
        if errores <= 5:
            print(f"❌ Error fila {idx+2}: {str(e)[:100]}")

print("\n" + "=" * 60)
print("📈 RESUMEN DE IMPORTACIÓN")
print("=" * 60)
print(f"✅ Proyectos nuevos:       {proyectos_creados}")
print(f"ℹ️  Proyectos existentes:   {proyectos_existentes}")
print(f"⚠️  Sin cliente encontrado: {sin_cliente}")
print(f"❌ Errores:                {errores}")
print("=" * 60)
print("✅ IMPORTACIÓN COMPLETADA")
print("=" * 60)
