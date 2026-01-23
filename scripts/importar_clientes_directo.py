"""
Script para importar clientes directamente a Supabase
Lee CSV, limpia duplicados y sube a la base de datos
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
    raise ValueError("Faltan variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Vendedor por defecto (admin)
DEFAULT_VENDEDOR_ID = "7818ac9d-f7c0-4540-bb32-e04d7423652c"


def limpiar_documento(valor):
    """Limpia y clasifica RUC/DNI"""
    if pd.isna(valor) or valor is None or str(valor).strip() in ['-', '', 'nan']:
        return ("", "OTRO")
    
    doc = str(valor).strip()
    
    # Manejar notación científica
    if 'e' in doc.lower() or 'E' in doc:
        try:
            doc = str(int(float(doc)))
        except:
            pass
    
    # Quitar caracteres no numéricos
    doc = re.sub(r'[^\d]', '', doc)
    
    # Clasificar
    if len(doc) == 11:
        return (doc, "RUC")
    elif len(doc) == 8:
        return (doc, "DNI")
    elif len(doc) > 0:
        return (doc, "OTRO")
    else:
        return ("", "OTRO")


def limpiar_texto(valor):
    """Limpia texto, retorna None si está vacío"""
    if pd.isna(valor) or valor is None:
        return None
    
    texto = str(valor).strip()
    
    if texto in ['-', '--', '.', '', 'N/A', 'n/a', 'NA', 'na', 'S/D', 's/d', 'nan']:
        return None
    
    return texto


print("=" * 60)
print("🚀 IMPORTACIÓN DIRECTA A SUPABASE")
print("=" * 60)

# Leer CSV
archivo = r'c:\Users\Lenovo\Documents\crmnew\clientessubirdb.csv'
print(f"\n📂 Leyendo: {archivo}")

# Probar diferentes encodings y separadores
df = None
for enc in ['latin-1', 'utf-8', 'cp1252', 'iso-8859-1']:
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

# NO normalizar - el CSV ya tiene los nombres correctos en minúsculas
# df.columns = [str(c).strip().upper() for c in df.columns]

# Columnas esperadas (buscar case-insensitive)
df_cols_upper = [str(c).strip().upper() for c in df.columns]
col_map = {c.upper(): c for c in df.columns}

col_empresa = col_map.get('EMPRESA') or next((col_map[c] for c in df_cols_upper if 'CLIENTE' in c and 'ID' not in c), None)
col_ruc = col_map.get('RUC') or col_map.get('DNI')
col_contacto = col_map.get('NOMBRE') or col_map.get('CONTACTO')
col_email = col_map.get('EMAIL') or col_map.get('CORREO')
col_telefono = col_map.get('TELEFONO') or col_map.get('TELÉFONO') or col_map.get('TEL')
col_direccion = col_map.get('DIRECCION') or col_map.get('DIRECCIÓN')

print(f"\n🔍 Mapeo de columnas:")
print(f"   Empresa: {col_empresa}")
print(f"   RUC/DNI: {col_ruc}")
print(f"   Contacto: {col_contacto}")
print(f"   Email: {col_email}")
print(f"   Teléfono: {col_telefono}")
print(f"   Dirección: {col_direccion}")

if not col_empresa or not col_ruc:
    raise Exception("Faltan columnas esenciales (EMPRESA, RUC)")

# Limpiar duplicados
print("\n🧹 Limpiando duplicados...")
df_antes = len(df)
df = df.drop_duplicates(subset=[col_ruc], keep='first')
df = df[df[col_ruc].notna()]
print(f"   Eliminados: {df_antes - len(df)} duplicados")
print(f"   Total a importar: {len(df)}")

# Insertar clientes
print("\n📤 Insertando clientes en Supabase...")
clientes_creados = 0
clientes_existentes = 0
contactos_creados = 0
errores = 0

for idx, row in df.iterrows():
    try:
        empresa = limpiar_texto(row[col_empresa])
        if not empresa:
            continue
        
        documento, tipo_doc = limpiar_documento(row[col_ruc])
        if not documento:
            print(f"⚠️  Fila {idx+2}: Sin documento para '{empresa}'")
            continue
        
        contacto_nombre = limpiar_texto(row[col_contacto]) if col_contacto else "Contacto Principal"
        if not contacto_nombre:
            contacto_nombre = "Contacto Principal"
        
        email = limpiar_texto(row[col_email]) if col_email else None
        telefono = limpiar_texto(row[col_telefono]) if col_telefono else None
        direccion = limpiar_texto(row[col_direccion]) if col_direccion else None
        
        # Verificar si existe
        existing = supabase.table("clientes").select("id").eq("ruc", documento).execute()
        
        if existing.data and len(existing.data) > 0:
            cliente_id = existing.data[0]["id"]
            clientes_existentes += 1
            if idx % 50 == 0:
                print(f"   Procesando... {idx}/{len(df)}")
        else:
            # Insertar cliente
            cliente_data = {
                "nombre": contacto_nombre,
                "empresa": empresa,
                "ruc": documento,
                "tipo_documento": tipo_doc,
                "email": email,
                "telefono": telefono,
                "direccion": direccion,
                "vendedor_id": DEFAULT_VENDEDOR_ID,
                "estado": "activo",
                "sector": "General",
                "cotizaciones": 0,
                "proyectos": 0,
                "proyectos_ganados": 0,
                "valor_total": 0,
                "tasa_conversion": 0
            }
            
            result = supabase.table("clientes").insert(cliente_data).execute()
            cliente_id = result.data[0]["id"]
            clientes_creados += 1
            
            if idx % 50 == 0 or clientes_creados % 10 == 0:
                print(f"   ✅ {clientes_creados} clientes creados ({idx}/{len(df)} procesados)")
        
        # Crear contacto
        contacto_data = {
            "cliente_id": cliente_id,
            "nombre": contacto_nombre,
            "email": email,
            "telefono": telefono,
            "cargo": "Contacto Principal",
            "es_principal": True
        }
        
        # Verificar si ya existe
        existing_contacto = supabase.table("contactos").select("id").eq("cliente_id", cliente_id).eq("nombre", contacto_nombre).execute()
        
        if not existing_contacto.data or len(existing_contacto.data) == 0:
            supabase.table("contactos").insert(contacto_data).execute()
            contactos_creados += 1
        
    except Exception as e:
        errores += 1
        if errores <= 5:  # Mostrar solo los primeros 5 errores
            print(f"❌ Error fila {idx+2}: {str(e)[:100]}")

print("\n" + "=" * 60)
print("📈 RESUMEN DE IMPORTACIÓN")
print("=" * 60)
print(f"✅ Clientes nuevos:      {clientes_creados}")
print(f"ℹ️  Clientes existentes:  {clientes_existentes}")
print(f"✅ Contactos creados:    {contactos_creados}")
print(f"❌ Errores:              {errores}")
print("=" * 60)
print("✅ IMPORTACIÓN COMPLETADA")
print("=" * 60)
