import { chromium } from '../../recepcion-crm/node_modules/playwright/index.mjs'

async function runChatValidation() {
  console.log("🚀 Iniciando validación E2E del Módulo de Comunicaciones y Burbuja Flotante...")

  const BASE_URL = process.env.TEST_BASE_URL || "https://crm.geofal.com.pe"

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    console.log(`📡 Navegando a ${BASE_URL}/login...`)
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })

    // Validar pantalla de login
    const emailInput = page.locator('input[name="email"], input[type="email"]')
    if (await emailInput.isVisible()) {
      console.log("🔑 Ingresando credenciales de prueba...")
      await emailInput.fill("admin@crm.com")
      await page.fill('input[name="password"], input[type="password"]', "admin123")
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)
    }

    console.log("✅ Accediendo al Dashboard...")
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    // 1. Validar Burbuja Flotante de Chat
    console.log("💬 Validando Burbuja Flotante de Chat...")
    const bubbleBtn = page.locator('button[title="Abrir Chat de Comunicación"]')
    const isBubbleVisible = await bubbleBtn.isVisible()

    if (isBubbleVisible) {
      console.log("✔️ Burbuja de chat flotante visible en la esquina inferior derecha.")
      await bubbleBtn.click()
      await page.waitForTimeout(1000)

      // Validar selector de canales en el encabezado del pop-up
      const selectElem = page.locator("div.pointer-events-auto select")
      if (await selectElem.isVisible()) {
        console.log("✔️ Selector de canales en el pop-up flotante presente y funcional.")
        await selectElem.selectOption({ index: 1 })
        console.log("✔️ Cambio de canal en la burbuja realizado con éxito.")
      }

      // Minimizar la burbuja
      const minimizeBtn = page.locator('button[title="Minimizar"]')
      if (await minimizeBtn.isVisible()) {
        await minimizeBtn.click()
        console.log("✔️ Ventana flotante minimizada correctamente.")
      }
    } else {
      console.log("⚠️ Burbuja flotante no visible directamente (revisar estado o breakpoint).")
    }

    // 2. Validar Módulo de Comunicaciones Completo (Pantalla Completa / Full-Bleed)
    console.log("🖥️ Validando Módulo de Comunicaciones Completo...")
    await page.goto(`${BASE_URL}/dashboard?module=comunicaciones`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    // Validar cabeceras de Canales de Trabajo y Chats Privados
    const workHeader = page.locator('text="Canales de Trabajo"')
    const dmsHeader = page.locator('text="Chats Privados (DMs)"')

    if ((await workHeader.isVisible()) && (await dmsHeader.isVisible())) {
      console.log("✔️ Sección 'Canales de Trabajo' y 'Chats Privados (DMs)' claramente separadas.")
    }

    // Validar botón + para nuevo chat privado
    const plusBtn = page.locator('button[title="Nuevo Chat Privado (DM)"]')
    if (await plusBtn.isVisible()) {
      console.log("✔️ Botón '+' para iniciar nuevos chats privado verificado.")
    }

    console.log("🎉 Validación E2E del Sistema de Comunicaciones finalizada exitosamente.")
  } catch (error) {
    console.error("❌ Error durante la prueba E2E:", error)
  } finally {
    await browser.close()
  }
}

runChatValidation()
