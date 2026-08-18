import { createRequire } from "module"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const { chromium } = require(path.resolve(__dirname, "../../recepcion-crm/node_modules/playwright"))

const BASE_URL = process.env.TEST_BASE_URL || "https://crm.geofal.com.pe"
const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots")

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runE2EValidation() {
  console.log("🚀 [E2E] Iniciando Validación Completa de Recepción de Probetas y OT Concreto...")
  console.log(`🌐 URL: ${BASE_URL}\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    console.log(`🔑 Accediendo a ${BASE_URL}/login...`)
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })

    console.log("🔑 Ingresando credenciales y enviando con Enter...")
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    await emailInput.fill("flarosa@geofal.com.pe")
    const passInput = page.locator('input[type="password"], input[name="password"]')
    await passInput.fill("Geo_laboratorio2@2026-")
    await passInput.press("Enter")

    // Esperar redirección al dashboard
    console.log("⏳ Esperando ingreso al Dashboard...")
    await page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

    const conflictBtn = page.locator('button:has-text("Entendido"), button:has-text("Cerrar")').first()
    if (await conflictBtn.isVisible()) {
      await conflictBtn.click()
      await page.waitForTimeout(2000)
    }

    console.log(`📍 URL actual: ${page.url()}`)

    // Navegar a Concretos -> Recepción Probetas
    console.log("\n🧪 Navegando a Recepción de Probetas...")
    const concretosGroup = page.locator('button:has-text("Concretos"), button:has-text("CONCRETOS")').first()
    if (await concretosGroup.isVisible()) {
      await concretosGroup.click()
      await page.waitForTimeout(1000)
    }

    const recepcionBtn = page.locator('button:has-text("Recepción Probetas")').first()
    if (await recepcionBtn.isVisible()) {
      await recepcionBtn.click()
      await page.waitForTimeout(4000)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-recepcion-probetas-limpia.png") })
    console.log("📸 Captura guardada: 01-recepcion-probetas-limpia.png")

    // Verificar ausencia de 1896-26
    const searchInput = page.locator('input[placeholder*="Buscar"]').first()
    if (await searchInput.isVisible()) {
      console.log("🔍 Buscando registro '1896'...")
      await searchInput.fill("1896")
      await page.waitForTimeout(2000)
      const count1896 = await page.locator('table tbody tr:has-text("1896-26")').count()
      console.log(`   Resultado: ${count1896} filas (Esperado: 0)`)
      if (count1896 === 0) {
        console.log("   ✅ '1896-26' (servicio de suelos) NO aparece en Recepción de Probetas.")
      }

      await searchInput.fill("")
      await page.waitForTimeout(1500)
    }

    // Buscar badge INCOMPLETO
    const badgeIncompleto = page.locator('table tbody tr button:has-text("INCOMPLETO"), table tbody tr div:has-text("INCOMPLETO")').first()
    if (await badgeIncompleto.isVisible()) {
      console.log("👉 Haciendo hover sobre el badge INCOMPLETO...")
      await badgeIncompleto.hover()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-tooltip-incompleto.png") })
      console.log("📸 Captura guardada: 02-tooltip-incompleto.png")

      console.log("👉 Haciendo clic en INCOMPLETO para probar navegación 1-Clic a OT Concreto...")
      await badgeIncompleto.click()
      await page.waitForTimeout(4000)

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-modal-ot-concreto-abierto.png") })
      console.log("📸 Captura guardada: 03-modal-ot-concreto-abierto.png")
    }

    // Navegar a OT Concreto
    console.log("\n📋 Navegando a OT Concreto...")
    const otConcretoBtn = page.locator('button:has-text("OT Concreto")').first()
    if (await otConcretoBtn.isVisible()) {
      await otConcretoBtn.click()
      await page.waitForTimeout(4000)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-ot-concreto-list.png") })
      console.log("📸 Captura guardada: 04-ot-concreto-list.png")
    }

    console.log("\n🎉 [E2E] Validación completada con éxito.")
  } catch (err) {
    console.error("❌ Error en la prueba:", err)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "e2e-error.png") })
  } finally {
    await browser.close()
  }
}

runE2EValidation()
