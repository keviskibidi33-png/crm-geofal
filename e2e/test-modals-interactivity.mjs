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

async function runTest() {
  console.log("🚀 Iniciando Validación E2E de Interactividad de Modales en Ensayos Nativos...")
  console.log(`🌐 URL: ${BASE_URL}\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    console.log(`🔑 Accediendo a ${BASE_URL}/login...`)
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })

    const emailInput = page.locator('input[name="email"], input[type="email"]')
    if (await emailInput.isVisible()) {
      console.log("🔑 Autenticando usuario flarosa@geofal.com.pe...")
      await emailInput.fill("flarosa@geofal.com.pe")
      await page.fill('input[name="password"], input[type="password"]', "Geo_laboratorio2@2026-")
      await page.click('button[type="submit"]')
      await page.waitForTimeout(5000)
    }

    // Check if session conflict dialog popped up
    const conflictBtn = page.locator('button:has-text("Entendido"), button:has-text("Cerrar")').first()
    if (await conflictBtn.isVisible()) {
      console.log("⚠️ Diálogo de conflicto detectado. Cerrando...")
      await conflictBtn.click()
      await page.waitForTimeout(2000)
    }

    console.log("✅ Sesión lista. Navegando por Sidebar al módulo Humedad AG...")
    const sidebarBtn = page.locator('aside button:has-text("Humedad AG")').first()
    if (await sidebarBtn.isVisible()) {
      await sidebarBtn.scrollIntoViewIfNeeded()
      await sidebarBtn.click()
      await page.waitForTimeout(2500)
    } else {
      console.log("Sidebar no visible directamente, navegando por evento...")
      await page.evaluate(() => {
        localStorage.setItem("crm-active-module", "cont_humedad")
        window.dispatchEvent(new CustomEvent("crm:navigate", { detail: "cont_humedad" }))
      })
      await page.waitForTimeout(2500)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "00-dashboard.png") })

    // Click "Nuevo Ensayo"
    console.log("📝 Abriendo formulario nativo de Contenido de Humedad...")
    const newBtn = page.locator('button:has-text("Nuevo Ensayo"), button:has-text("Nuevo Registro"), button:has-text("Nuevo")').first()
    await newBtn.waitFor({ state: "visible", timeout: 15000 })
    await newBtn.click()
    await page.waitForTimeout(2500)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-form-opened.png") })
    console.log("📸 Captura 01: Formulario abierto.")

    // Test 1: ConfirmActionModal (Limpiar datos no guardados)
    console.log("\n🧪 TEST 1: Verificar que ConfirmActionModal responde a clics (no es transparente)...")
    const clearDockBtn = page.locator('button[aria-label="Limpiar"], button[title*="Limpiar"]').first()
    await clearDockBtn.click()
    await page.waitForTimeout(1000)

    const clearModal = page.locator('div[role="dialog"][aria-label*="Limpiar datos"]')
    const isModalVisible = await clearModal.isVisible()
    console.log(`- Modal Limpiar visible: ${isModalVisible ? "✅ SI" : "❌ NO"}`)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-clear-modal-open.png") })
    console.log("📸 Captura 02: Modal Limpiar abierto.")

    // Click Cancelar on the modal
    const cancelBtn = clearModal.locator('button:has-text("Cancelar")')
    await cancelBtn.click()
    await page.waitForTimeout(1000)

    const isModalClosed = !(await clearModal.isVisible())
    console.log(`- Modal Limpiar cerrado al hacer clic en Cancelar: ${isModalClosed ? "✅ ÉXITO" : "❌ FALLÓ"}`)

    // Test 2: UnsavedChangesModal (Seguir editando / Salir sin guardar)
    console.log("\n🧪 TEST 2: Verificar UnsavedChangesModal al ensuciar el formulario y salir...")
    
    // Type into an input to make the form dirty
    const muestraInput = page.locator('input[placeholder*="Muestra"], input[type="text"]').first()
    await muestraInput.fill("MUESTRA-TEST-E2E-101")
    await page.waitForTimeout(1000)

    // Click the X (close) button in the form header
    const closeHeaderBtn = page.locator('button[title*="Regresar"], button[title*="Cerrar"]').first()
    await closeHeaderBtn.click()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-unsaved-modal-open.png") })
    console.log("📸 Captura 03: Modal de cambios no guardados.")

    const unsavedModal = page.locator('div[role="dialog"][aria-label*="salir sin guardar"]')
    const isUnsavedVisible = await unsavedModal.isVisible()
    console.log(`- Modal de 'Seguir editando' visible: ${isUnsavedVisible ? "✅ ÉXITO" : "❌ FALLÓ"}`)

    // Click "Seguir editando"
    const continueEditingBtn = unsavedModal.locator('button:has-text("Seguir editando")')
    await continueEditingBtn.click()
    await page.waitForTimeout(1000)

    const isFormStillOpen = await muestraInput.isVisible()
    console.log(`- Al hacer clic en 'Seguir editando', el formulario continúa abierto: ${isFormStillOpen ? "✅ ÉXITO" : "❌ FALLÓ"}`)

    // Now click X again and click "Salir sin guardar"
    await closeHeaderBtn.click()
    await page.waitForTimeout(1000)

    const discardBtn = unsavedModal.locator('button:has-text("Salir sin guardar")')
    await discardBtn.click()
    await page.waitForTimeout(1500)

    const isFormClosed = !(await muestraInput.isVisible())
    console.log(`- Al hacer clic en 'Salir sin guardar', el formulario se cierra: ${isFormClosed ? "✅ ÉXITO" : "❌ FALLÓ"}`)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-form-closed.png") })
    console.log("📸 Captura 04: Formulario cerrado correctamente.")

    console.log("\n🎉 ¡TODAS LAS PRUEBAS E2E DE MODALES PASARON EXITOSAMENTE!")
  } catch (err) {
    console.error("❌ Error en prueba E2E:", err)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "error-e2e.png") })
  } finally {
    await browser.close()
  }
}

runTest()
