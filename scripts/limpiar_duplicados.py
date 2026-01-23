"""
Script robusto para limpiar duplicados del CSV de clientes
Prueba múltiples encodings y formatos
"""

import pandas as pd
import os

archivo_entrada = r'c:\Users\Lenovo\Documents\crmnew\clientessubirdb.csv'

# Lista de encodings a probar
encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1', 'utf-8-sig']

df = None
for enc in encodings:
    try:
        print(f"🔄 Intentando con encoding: {enc}")
        # Probar con diferentes separadores
        for sep in [',', ';', '\t']:
            try:
                df_temp = pd.read_csv(archivo_entrada, encoding=enc, sep=sep, on_bad_lines='skip')
                if len(df_temp.columns) > 1:  # Tiene más de una columna
                    df = df_temp
                    print(f"✅ Éxito con encoding={enc}, separador='{sep}'")
                    break
            except:
                continue
        if df is not None:
            break
    except Exception as e:
        continue

if df is None:
    print("❌ No se pudo leer el archivo con ningún encoding")
    exit(1)

print(f"\n📊 Filas originales: {len(df)}")
print(f"📋 Columnas detectadas ({len(df.columns)}): {list(df.columns)}")

# Detectar columna de RUC/DNI
col_ruc = None
for col in df.columns:
    col_upper = str(col).upper().strip()
    if 'RUC' in col_upper or 'DNI' in col_upper or 'DOCUMENTO' in col_upper:
        col_ruc = col
        break

if not col_ruc:
    # Si no encuentra, usar la primera columna que tenga números
    for col in df.columns:
        if df[col].dtype in ['int64', 'float64'] or df[col].astype(str).str.isdigit().any():
            col_ruc = col
            print(f"⚠️  No se encontró columna RUC explícita, usando: {col}")
            break

if not col_ruc:
    print("❌ No se pudo identificar columna de RUC/DNI")
    print("\nPrimeras filas:")
    print(df.head())
    exit(1)

print(f"🔍 Columna RUC identificada: {col_ruc}")

# Eliminar filas donde RUC es nulo o vacío
df = df.dropna(subset=[col_ruc])
df = df[df[col_ruc].astype(str).str.strip() != '']

# Contar duplicados antes
duplicados_antes = df[col_ruc].duplicated(keep=False).sum()
print(f"⚠️  Registros con RUC duplicado: {duplicados_antes}")

# Mostrar algunos ejemplos de duplicados
if duplicados_antes > 0:
    dups = df[df[col_ruc].duplicated(keep=False)][col_ruc].value_counts().head(5)
    print("\n🔢 Ejemplos de RUCs duplicados:")
    for ruc, count in dups.items():
        print(f"   {ruc}: {count} veces")

# Eliminar duplicados - quedarse con el primero
df_limpio = df.drop_duplicates(subset=[col_ruc], keep='first')

# Contar después
eliminados = len(df) - len(df_limpio)
print(f"\n🗑️  Registros eliminados: {eliminados}")
print(f"✅ Filas finales: {len(df_limpio)}")

# Guardar CSV limpio
output_file = r'c:\Users\Lenovo\Documents\crmnew\clientessubirdb_limpio.csv'
df_limpio.to_csv(output_file, index=False, encoding='utf-8-sig', sep=',')

print(f"\n💾 Archivo guardado: {output_file}")
print(f"📏 Tamaño: {os.path.getsize(output_file) / 1024:.2f} KB")
print("\n✅ Ahora puedes importar 'clientessubirdb_limpio.csv' en Supabase")
print("   (Usa encoding UTF-8 al importar)")
