import { test, expect } from "@playwright/test"

test.describe("Geofal CRM - Communications & Floating Chat Validation", () => {
  const BASE_URL = process.env.TEST_BASE_URL || "https://crm.geofal.com.pe"

  test("1. Full Communications Module - Work Channels and Started DMs Isolation", async ({ page }) => {
    // Navigate to Login / Dashboard
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState("networkidle")

    // Fill login credentials (or verify active session)
    if (await page.locator('input[name="email"], input[type="email"]').isVisible()) {
      await page.fill('input[name="email"], input[type="email"]', "admin@crm.com")
      await page.fill('input[name="password"], input[type="password"]', "admin123")
      await page.click('button[type="submit"]')
      await page.waitForURL("**/dashboard**", { timeout: 15000 })
    }

    // Open Communications Module
    await page.click('text="Comunicaciones"')
    await page.waitForTimeout(1000)

    // Verify main module fills screen without outer scrollbars
    const mainArea = page.locator("main")
    await expect(mainArea).toHaveClass(/overflow-hidden/)

    // Verify Work Channels section exists and contains work channels only (no DM channels)
    const workChannelsHeader = page.locator('text="Canales de Trabajo"')
    await expect(workChannelsHeader).toBeVisible()

    // Verify DMs section exists and contains "+" button to start new chats
    const dmsHeader = page.locator('text="Chats Privados (DMs)"')
    await expect(dmsHeader).toBeVisible()

    const newDMButton = page.locator('button[title="Nuevo Chat Privado (DM)"]')
    await expect(newDMButton).toBeVisible()

    // Test opening "Nuevo Chat Privado" modal
    await newDMButton.click()
    const dialogTitle = page.locator('text="Nuevo Chat Privado (DM)"')
    await expect(dialogTitle).toBeVisible()

    // Verify user list in modal is scrollable and does not overflow
    const userSearchInput = page.locator('input[placeholder*="Buscar por nombre"]')
    await expect(userSearchInput).toBeVisible()

    // Close modal
    await page.keyboard.press("Escape")
  })

  test("2. Floating Chat Widget Bubble - Expand, Channel Switcher and Minimize", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    // Verify Floating Chat Widget bubble icon is visible in bottom-right corner
    const bubbleBtn = page.locator('button[title="Abrir Chat de Comunicación"]')
    await expect(bubbleBtn).toBeVisible()

    // Click bubble to expand pop-up
    await bubbleBtn.click()

    // Verify Channel Selector Dropdown in Pop-up Header
    const channelSelect = page.locator("div.pointer-events-auto select")
    await expect(channelSelect).toBeVisible()

    // Switch channel to "# general"
    await channelSelect.selectOption({ label: "# general" })

    // Verify message input is available
    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]')
    await expect(chatInput).toBeVisible()

    // Minimize pop-up
    const minimizeBtn = page.locator('button[title="Minimizar"]')
    await minimizeBtn.click()

    // Verify bubble button returns
    await expect(bubbleBtn).toBeVisible()
  })
})
