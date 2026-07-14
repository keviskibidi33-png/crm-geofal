import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://db.geofal.com.pe";
const SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODY4NzY0MCwiZXhwIjo0OTM0MzYxMjQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.eH_lLQ_RF3_Py_bLzjOI2iPrWyxzmcATlxkBzmwbU9A";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // Columnas de verificacion_muestras:
  // id, numero_verificacion, codigo_documento, version, fecha_documento, pagina, verificado_por,
  // fecha_verificacion, cliente, equipo_bernier, equipo_lainas_1, equipo_lainas_2,
  // equipo_escuadra, equipo_balanza, nota, fecha_creacion, fecha_actualizacion, archivo_excel, object_key

  console.log("=== 1. Verificacion id:560 (1343-REC fantasma) ===");
  const { data: v560, error: ev560 } = await supabase
    .from("verificacion_muestras")
    .select("id,numero_verificacion,cliente,fecha_verificacion,verificado_por,fecha_creacion,object_key")
    .eq("id", 560);
  if (ev560) console.error(ev560.message);
  else console.log(JSON.stringify(v560, null, 2));

  console.log("\n=== 2. Verificacion id:561 (1343-26 real) ===");
  const { data: v561, error: ev561 } = await supabase
    .from("verificacion_muestras")
    .select("id,numero_verificacion,cliente,fecha_verificacion,verificado_por,fecha_creacion,object_key")
    .eq("id", 561);
  if (ev561) console.error(ev561.message);
  else console.log(JSON.stringify(v561, null, 2));

  console.log("\n=== 3. Buscar TODA verificacion de 1343 ===");
  const { data: vAll, error: evAll } = await supabase
    .from("verificacion_muestras")
    .select("id,numero_verificacion,cliente,fecha_verificacion,verificado_por,fecha_creacion")
    .ilike("numero_verificacion", "%1343%")
    .limit(10);
  if (evAll) console.error(evAll.message);
  else console.log(JSON.stringify(vAll, null, 2));

  console.log("\n=== 4. Compresion vinculada a 1343 ===");
  const { data: comp, error: eComp } = await supabase
    .from("ensayo_compresion")
    .select("id,numero_recepcion,estado,fecha_creacion,numero_ot")
    .ilike("numero_recepcion", "%1343%")
    .limit(10);
  if (eComp) console.error(eComp.message);
  else console.log(JSON.stringify(comp, null, 2));

  // Análisis de las eliminaciones masivas recientes
  console.log("\n=== 5. IDs eliminados en todo el rango (1-570) - detectar patrones ===");
  const { data: allRec, error: eAll } = await supabase
    .from("recepcion")
    .select("id,numero_recepcion,fecha_creacion")
    .order("id", { ascending: true });
  if (eAll) console.error(eAll.message);
  else {
    const existingIds = new Set(allRec.map((r) => r.id));
    const maxId = Math.max(...allRec.map((r) => r.id));
    const gaps = [];
    for (let i = 1; i <= maxId; i++) {
      if (!existingIds.has(i)) gaps.push(i);
    }
    console.log(`Total registros actuales: ${allRec.length}`);
    console.log(`ID máximo: ${maxId}`);
    console.log(`Total IDs faltantes (eliminados): ${gaps.length}`);
    console.log(`IDs eliminados:`, gaps);
  }
}

main().catch(console.error);
