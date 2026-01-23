"""
Script de Importación de Clientes y Proyectos para CRM Geofal
==============================================================
Este script lee los archivos Excel proporcionados y carga los datos
en la base de datos Supabase.

Archivos esperados:
- clientessubirdb.xlsx: Lista de clientes (empresas + contactos)
- proyectosporruc.xlsx: Lista de proyectos por RUC con ubicaciones

Requisitos:
pip install pandas openpyxl supabase python-dotenv
"""

import os
import re
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Vendedor por defecto (admin)
DEFAULT_VENDEDOR_ID = "7818ac9d-f7c0-4540-bb32-e04d7423652c"


def limpiar_documento(valor) -> tuple[str, str]:
    """
    Limpia y clasifica el número de documento (RUC o DNI).
    Retorna: (numero_limpio, tipo_documento)
    """
    if pd.isna(valor) or valor is None:
        return ("", "OTRO")
    
    # Convertir a string y limpiar
    doc = str(valor).strip()
    
    # Manejar notación científica (ej: 2.06E+10)
    if 'e' in doc.lower() or 'E' in doc:
        try:
            doc = str(int(float(doc)))
        except:
            pass
    
    # Quitar caracteres no numéricos
    doc = re.sub(r'[^\d]', '', doc)
    
    # Clasificar por longitud
    if len(doc) == 11:
        return (doc, "RUC")
    elif len(doc) == 8:
        return (doc, "DNI")
    elif len(doc) > 0:
        return (doc, "OTRO")
    else:
        return ("", "OTRO")


def limpiar_direccion(valor) -> str | None:
    """
    Limpia la dirección, retornando None si está vacía o es solo un guion.
    """
    if pd.isna(valor) or valor is None:
        return None
    
    direccion = str(valor).strip()
    
    # Ignorar guiones, puntos o valores vacíos
    if direccion in ['-', '--', '.', '', 'N/A', 'n/a', 'NA', 'na', 'S/D', 's/d']:
        return None
    
    return direccion


def limpiar_telefono(valor) -> str | None:
    """Limpia el teléfono, retornando None si está vacío."""
    if pd.isna(valor) or valor is None:
        return None
    
    telefono = str(valor).strip()
    
    # Quitar caracteres no válidos excepto + y números
    telefono = re.sub(r'[^\d+]', '', telefono)
    
    if len(telefono) < 6:
        return None
    
    return telefono


def importar_clientes(archivo_excel: str):
    """
    Importa clientes desde el archivo Excel.
    Estructura esperada del Excel:
    - EMPRESA (o RAZON SOCIAL)
    - RUC
    - CONTACTO (nombre de la persona)
    - EMAIL
    - TELEFONO
    - DIRECCION (opcional)
    """
    print(f"\n📂 Leyendo archivo: {archivo_excel}")
    
    try:
        # Intentar leer como CSV primero (con encoding Windows)
        if archivo_excel.endswith('.csv'):
            df = pd.read_csv(archivo_excel, encoding='cp1252', sep=',')
        else:
            df = pd.read_excel(archivo_excel)
    except Exception as e:
        print(f"❌ Error leyendo archivo: {e}")
        return
    
    print(f"📊 Filas encontradas: {len(df)}")
    print(f"📋 Columnas: {list(df.columns)}")
    
    # Normalizar nombres de columnas
    df.columns = [str(c).strip().upper() for c in df.columns]
    
    # Mapeo flexible de columnas
    col_empresa = next((c for c in df.columns if 'EMPRESA' in c or 'RAZON' in c or 'RAZÓN' in c), None)
    col_ruc = next((c for c in df.columns if 'RUC' in c or 'DNI' in c or 'DOCUMENTO' in c), None)
    col_contacto = next((c for c in df.columns if 'CONTACTO' in c or 'NOMBRE' in c or 'PERSONA' in c), None)
    col_email = next((c for c in df.columns if 'EMAIL' in c or 'CORREO' in c or 'MAIL' in c), None)
    col_telefono = next((c for c in df.columns if 'TELEFONO' in c or 'TELÉFONO' in c or 'CEL' in c or 'MOVIL' in c), None)
    col_direccion = next((c for c in df.columns if 'DIRECCION' in c or 'DIRECCIÓN' in c or 'DIR' in c), None)
    
    print(f"🔍 Columnas detectadas:")
    print(f"   Empresa: {col_empresa}")
    print(f"   RUC/DNI: {col_ruc}")
    print(f"   Contacto: {col_contacto}")
    print(f"   Email: {col_email}")
    print(f"   Teléfono: {col_telefono}")
    print(f"   Dirección: {col_direccion}")
    
    if not col_empresa or not col_ruc:
        print("❌ No se encontraron columnas esenciales (EMPRESA, RUC)")
        return
    
    clientes_creados = 0
    contactos_creados = 0
    errores = 0
    
    # Procesar cada fila
    for idx, row in df.iterrows():
        try:
            empresa = str(row[col_empresa]).strip() if pd.notna(row[col_empresa]) else None
            if not empresa or empresa.lower() in ['nan', 'none', '']:
                continue
            
            documento, tipo_doc = limpiar_documento(row[col_ruc] if col_ruc else None)
            if not documento:
                print(f"⚠️  Fila {idx+2}: Sin documento válido para '{empresa}'")
                continue
            
            contacto_nombre = str(row[col_contacto]).strip() if col_contacto and pd.notna(row[col_contacto]) else "Contacto Principal"
            email = str(row[col_email]).strip() if col_email and pd.notna(row[col_email]) else None
            telefono = limpiar_telefono(row[col_telefono] if col_telefono else None)
            direccion = limpiar_direccion(row[col_direccion] if col_direccion else None)
            
            # Verificar si el cliente ya existe por RUC
            existing = supabase.table("clientes").select("id").eq("ruc", documento).execute()
            
            if existing.data and len(existing.data) > 0:
                cliente_id = existing.data[0]["id"]
                print(f"ℹ️  Cliente existente: {empresa} ({documento})")
            else:
                # Crear nuevo cliente
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
                    "cotizaciones": 0,
                    "proyectos": 0,
                    "proyectos_ganados": 0,
                    "valor_total": 0,
                    "tasa_conversion": 0
                }
                
                result = supabase.table("clientes").insert(cliente_data).execute()
                cliente_id = result.data[0]["id"]
                clientes_creados += 1
                print(f"✅ Cliente creado: {empresa} ({documento})")
            
            # Crear contacto asociado
            contacto_data = {
                "cliente_id": cliente_id,
                "nombre": contacto_nombre,
                "email": email,
                "telefono": telefono,
                "cargo": "Contacto Principal",
                "es_principal": True
            }
            
            # Verificar si ya existe este contacto
            existing_contacto = supabase.table("contactos").select("id").eq("cliente_id", cliente_id).eq("nombre", contacto_nombre).execute()
            
            if not existing_contacto.data or len(existing_contacto.data) == 0:
                supabase.table("contactos").insert(contacto_data).execute()
                contactos_creados += 1
            
        except Exception as e:
            errores += 1
            print(f"❌ Error en fila {idx+2}: {e}")
    
    print(f"\n📈 Resumen de importación de clientes:")
    print(f"   ✅ Clientes creados: {clientes_creados}")
    print(f"   ✅ Contactos creados: {contactos_creados}")
    print(f"   ❌ Errores: {errores}")


def importar_proyectos(archivo_excel: str):
    """
    Importa proyectos desde el archivo Excel.
    Estructura esperada:
    - RUC (para vincular con cliente)
    - PROYECTO (nombre del proyecto)
    - UBICACION (ubicación de la obra)
    """
    print(f"\n📂 Leyendo archivo de proyectos: {archivo_excel}")
    
    try:
        # Intentar leer como CSV primero (con encoding Windows)
        if archivo_excel.endswith('.csv'):
            df = pd.read_csv(archivo_excel, encoding='cp1252', sep=',')
        else:
            df = pd.read_excel(archivo_excel)
    except Exception as e:
        print(f"❌ Error leyendo archivo: {e}")
        return
    
    print(f"📊 Filas encontradas: {len(df)}")
    print(f"📋 Columnas: {list(df.columns)}")
    
    # Normalizar nombres de columnas
    df.columns = [str(c).strip().upper() for c in df.columns]
    
    # Mapeo flexible de columnas
    col_ruc = next((c for c in df.columns if 'RUC' in c), None)
    col_proyecto = next((c for c in df.columns if 'PROYECTO' in c or 'NOMBRE' in c or 'OBRA' in c), None)
    col_ubicacion = next((c for c in df.columns if 'UBICACION' in c or 'UBICACIÓN' in c or 'LUGAR' in c or 'DIRECCION' in c), None)
    
    print(f"🔍 Columnas detectadas:")
    print(f"   RUC: {col_ruc}")
    print(f"   Proyecto: {col_proyecto}")
    print(f"   Ubicación: {col_ubicacion}")
    
    if not col_ruc or not col_proyecto:
        print("❌ No se encontraron columnas esenciales (RUC, PROYECTO)")
        return
    
    proyectos_creados = 0
    errores = 0
    sin_cliente = 0
    
    for idx, row in df.iterrows():
        try:
            documento, _ = limpiar_documento(row[col_ruc] if col_ruc else None)
            proyecto_nombre = str(row[col_proyecto]).strip() if pd.notna(row[col_proyecto]) else None
            ubicacion = limpiar_direccion(row[col_ubicacion] if col_ubicacion else None)
            
            if not proyecto_nombre or proyecto_nombre.lower() in ['nan', 'none', '']:
                continue
            
            # Buscar cliente por RUC
            cliente = supabase.table("clientes").select("id").eq("ruc", documento).execute()
            
            if not cliente.data or len(cliente.data) == 0:
                sin_cliente += 1
                print(f"⚠️  Fila {idx+2}: No existe cliente con RUC {documento} para proyecto '{proyecto_nombre}'")
                continue
            
            cliente_id = cliente.data[0]["id"]
            
            # Buscar contacto principal del cliente
            contacto = supabase.table("contactos").select("id").eq("cliente_id", cliente_id).eq("es_principal", True).execute()
            contacto_id = contacto.data[0]["id"] if contacto.data and len(contacto.data) > 0 else None
            
            # Verificar si el proyecto ya existe
            existing = supabase.table("proyectos").select("id").eq("cliente_id", cliente_id).eq("nombre", proyecto_nombre).execute()
            
            if existing.data and len(existing.data) > 0:
                print(f"ℹ️  Proyecto existente: {proyecto_nombre}")
                continue
            
            # Crear proyecto
            proyecto_data = {
                "cliente_id": cliente_id,
                "vendedor_id": DEFAULT_VENDEDOR_ID,
                "nombre": proyecto_nombre,
                "ubicacion": ubicacion,
                "estado": "activo",
                "etapa": "prospecto",
                "presupuesto": 0,
                "progreso": 0,
                "contacto_principal_id": contacto_id
            }
            
            supabase.table("proyectos").insert(proyecto_data).execute()
            proyectos_creados += 1
            print(f"✅ Proyecto creado: {proyecto_nombre}")
            
            # Actualizar contador de proyectos del cliente
            supabase.table("clientes").update({"proyectos": supabase.table("proyectos").select("id", count="exact").eq("cliente_id", cliente_id).execute().count}).eq("id", cliente_id).execute()
            
        except Exception as e:
            errores += 1
            print(f"❌ Error en fila {idx+2}: {e}")
    
    print(f"\n📈 Resumen de importación de proyectos:")
    print(f"   ✅ Proyectos creados: {proyectos_creados}")
    print(f"   ⚠️  Sin cliente encontrado: {sin_cliente}")
    print(f"   ❌ Errores: {errores}")


def main():
    """Función principal que ejecuta la importación."""
    print("=" * 60)
    print("🚀 SCRIPT DE IMPORTACIÓN CRM GEOFAL")
    print("=" * 60)
    
    # Rutas de archivos (ajustar según ubicación)
    base_path = r"c:\Users\Lenovo\Documents\crmnew"
    
    archivo_clientes = os.path.join(base_path, "clientessubirdb.csv")
    archivo_proyectos = os.path.join(base_path, "proyectosporruc.csv")
    
    # Paso 1: Importar clientes
    if os.path.exists(archivo_clientes):
        importar_clientes(archivo_clientes)
    else:
        print(f"⚠️  Archivo de clientes no encontrado: {archivo_clientes}")
    
    # Paso 2: Importar proyectos
    if os.path.exists(archivo_proyectos):
        importar_proyectos(archivo_proyectos)
    else:
        print(f"⚠️  Archivo de proyectos no encontrado: {archivo_proyectos}")
    
    print("\n" + "=" * 60)
    print("✅ IMPORTACIÓN COMPLETADA")
    print("=" * 60)


if __name__ == "__main__":
    main()
