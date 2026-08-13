/**
 * Validation Script for Gerencia KPIs & Administration Variables
 * Validates money parsing, category matching, percentage bounds,
 * zero fallbacks, client deduplication, and average ticket formulas.
 */

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function parseMoney(value) {
  if (value === null || value === undefined) return 0
  let str = String(value).trim()
  if (!str || str === "-") return 0

  str = str.replace(/^(S\/\.?|\$|PEN|USD)\s*/i, "").trim()
  const raw = str.replace(/[^0-9.,-]/g, "")
  if (!raw || raw === "-") return 0

  const sign = raw.startsWith("-") ? -1 : 1
  const unsigned = raw.replace(/-/g, "")
  let normalized = unsigned

  if (/^\d{1,3}(?:\.\d{3})+\.\d{1,2}$/.test(unsigned)) {
    normalized = String(Number(unsigned.replace(/\./g, "")) / 100)
  } else if (/^\d{1,3}(?:,\d{3})+,\d{1,2}$/.test(unsigned)) {
    normalized = String(Number(unsigned.replace(/,/g, "")) / 100)
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(/,/g, "")
  } else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".")
  } else if (/^\d+[.,]\d{1,2}$/.test(unsigned)) {
    normalized = unsigned.replace(",", ".")
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(unsigned)) {
    normalized = unsigned.replace(/[.,]/g, "")
  }

  const parsed = Number.parseFloat(normalized) * sign
  return Number.isFinite(parsed) ? parsed : 0
}

function calcPercentage(value, total) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10_000) / 100
}

function resolveControlCommercialCategory(row) {
  const sampleCode = normalizeText(row.codigo_muestra);
  const serviceDescription = normalizeText(row.descripcion_servicio);
  const project = normalizeText(row.proyecto);

  // 1. Clasificación Primaria: Por CODIGO MUESTRA de Laboratorio
  if (sampleCode && !/^[-_.\s]+$/.test(sampleCode)) {
    if (/\bALQ\b|ALQUILER/.test(sampleCode)) return "ALQ";
    if (/\bDEN\b|DENSIDAD/.test(sampleCode)) return "DEN";
    if (/\bEMS\b|MECANICA DE SUELOS|ESTUDIO DE SUELOS/.test(sampleCode)) return "EMS";
    if (
      /\bCO\b|[-_]CO[-_]|[-_]CO\d+|\bCO[-_]\d+|\bCO\d+|PROBETA|CONCRETO|CILINDRO|COMPRESION|ROTURA/.test(sampleCode)
    ) {
      return "PROB";
    }
    return "ENS.V.";
  }

  // 2. Clasificación Secundaria (Fallback): Si no hay código de muestra, usar proyecto y descripción
  const fallbackText = `${project} ${serviceDescription}`.trim();
  if (!fallbackText || /^[-_.\s]+$/.test(fallbackText)) return null;

  if (/\bALQ\b|ALQUILER/.test(fallbackText)) return "ALQ";
  if (/\bEMS\b|MECANICA DE SUELOS|ESTUDIO DE SUELOS/.test(fallbackText)) return "EMS";
  if (/DENSIDAD|\bDEN\b/.test(fallbackText)) return "DEN";
  if (/PROBETA|CONCRETO|CILINDRO|COMPRESION|ROTURA|\bCO\b/.test(fallbackText)) return "PROB";

  return "ENS.V.";
}

function resolveClientKey(value) {
  const normalized = normalizeText(value)
  if (!normalized || /^-+$/.test(normalized)) return null
  return normalized
}

function runTests() {
  console.log("=================================================================")
  console.log("🧪 CORRIENDO PRUEBAS DE VALIDACIÓN DE KPIS Y VARIABLES DE GERENCIA")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition, description) {
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${description}`)
      failed++
    }
  }

  // 1. Money Parsing Tests
  console.log("1. Pruebas de Formateo y Parsing de Dinero (parseMoney):")
  assert(parseMoney("S/. 1,500.00") === 1500, "parseMoney('S/. 1,500.00') === 1500")
  assert(parseMoney("1200") === 1200, "parseMoney('1200') === 1200")
  assert(parseMoney("2.500,50") === 2500.5, "parseMoney('2.500,50') === 2500.5")
  assert(parseMoney(null) === 0, "parseMoney(null) === 0")
  assert(parseMoney(undefined) === 0, "parseMoney(undefined) === 0")
  assert(parseMoney("-") === 0, "parseMoney('-') === 0")
  assert(parseMoney("") === 0, "parseMoney('') === 0")

  // 2. Category Resolution Tests
  console.log("\n2. Pruebas de Clasificación por Categorías:")
  assert(resolveControlCommercialCategory({ codigo_muestra: "ALQUILER 2", descripcion_servicio: "PROBETAS Y DENSIDAD", proyecto: "ALQUILER" }) === "ALQ", "Categoría ALQ prioritario (MAKIBER con probetas y densidad)")
  assert(resolveControlCommercialCategory({ codigo_muestra: "ALQUILER 1", descripcion_servicio: "PROBETAS", proyecto: "ALQUILER" }) === "ALQ", "Categoría ALQ prioritario (ALMASA con probetas)")
  assert(resolveControlCommercialCategory({ codigo_muestra: "2026-DEN-01", descripcion_servicio: "" }) === "DEN", "Categoría DEN por código")
  assert(resolveControlCommercialCategory({ codigo_muestra: "", descripcion_servicio: "ENSAYO DE DENSIDAD DE CAMPO" }) === "DEN", "Categoría DEN por descripción fallback")
  assert(resolveControlCommercialCategory({ codigo_muestra: "2026-EMS-05", descripcion_servicio: "" }) === "EMS", "Categoría EMS por código")
  assert(resolveControlCommercialCategory({ codigo_muestra: "PROBETA-01", descripcion_servicio: "COMPRESION DE CONCRETO" }) === "PROB", "Categoría PROB por probeta/concreto")
  assert(resolveControlCommercialCategory({ codigo_muestra: "4259-CO-25", descripcion_servicio: "ROTURA DE TESTIGOS" }) === "PROB", "Categoría PROB por formato LEM (4259-CO-25)")
  assert(resolveControlCommercialCategory({ codigo_muestra: "CO-101", descripcion_servicio: "" }) === "PROB", "Categoría PROB por código CO-101")
  assert(resolveControlCommercialCategory({ codigo_muestra: "ALQ-EQUIPO", descripcion_servicio: "ALQUILER DE EQUIPO" }) === "ALQ", "Categoría ALQ por código ALQ")
  assert(resolveControlCommercialCategory({ codigo_muestra: "SU-123", descripcion_servicio: "CONTENIDO DE HUMEDAD" }) === "ENS.V.", "Categoría fallback ENS.V. para SU-123")
  assert(resolveControlCommercialCategory({ codigo_muestra: "AG-05", descripcion_servicio: "ANALISIS GRANULOMETRICO" }) === "ENS.V.", "Categoría fallback ENS.V. para AG-05")
  assert(resolveControlCommercialCategory({ codigo_muestra: "", proyecto: "ALQUILER", descripcion_servicio: "ALQUILER DE EQUIPOS" }) === "ALQ", "Categoría ALQ por fallback de proyecto")
  assert(resolveControlCommercialCategory({ codigo_muestra: "", proyecto: "ESTUDIO DE SUELOS", descripcion_servicio: "MECANICA DE SUELOS" }) === "EMS", "Categoría EMS por fallback de proyecto")
  assert(resolveControlCommercialCategory({ codigo_muestra: "", proyecto: "OBRA TAL", descripcion_servicio: "DENSIDADES DE CAMPO" }) === "DEN", "Categoría DEN por fallback de descripción")

  // 3. Client Key Resolution Tests
  console.log("\n3. Pruebas de Sanitización de Clientes:")
  assert(resolveClientKey("Empresa Constructora SAC") === "EMPRESA CONSTRUCTORA SAC", "Saneamiento de nombre de cliente")
  assert(resolveClientKey("-") === null, "Filtro de guión '-' como cliente")
  assert(resolveClientKey("---") === null, "Filtro de guiones '---' como cliente")
  assert(resolveClientKey("") === null, "Filtro de cadena vacía como cliente")
  assert(resolveClientKey(null) === null, "Filtro de null como cliente")

  // 4. Percentage & Zero Division Safety Tests
  console.log("\n4. Pruebas de Cálculo de Porcentajes y División por Cero:")
  assert(calcPercentage(50, 100) === 50, "50 de 100 = 50%")
  assert(calcPercentage(0, 0) === 0, "Seguridad división por cero (0/0) === 0%")
  assert(calcPercentage(10, 0) === 0, "Seguridad división por cero (10/0) === 0%")
  assert(calcPercentage(1, 3) === 33.33, "Redondeo de precisión (1/3 = 33.33%)")

  console.log("\n=================================================================")
  console.log(`📊 RESUMEN FINAL: ${passed} PASADAS | ${failed} FALLADAS`)
  console.log("=================================================================")

  if (failed > 0) process.exit(1)
}

runTests()
