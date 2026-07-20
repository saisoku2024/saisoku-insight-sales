import { expect, type Page, test } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const guestEmail = process.env.E2E_GUEST_EMAIL || "guest@ssidmail.my.id"
const guestPassword = process.env.E2E_GUEST_PASSWORD || "guestonly123"
const runWriteFlow = process.env.E2E_WRITE_FLOW === "true"

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel(/email admin/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole("button", { name: /sign in to dashboard/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function getAccessToken(page: Page) {
  return await page.evaluate(() => {
    for (const value of Object.values(window.localStorage)) {
      try {
        const parsed = JSON.parse(String(value))
        const token = parsed?.access_token || parsed?.currentSession?.access_token
        if (typeof token === "string") return token
      } catch {
        // Ignore non-JSON localStorage entries.
      }
    }
    return null
  })
}

test("login page renders admin form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible()
  await expect(page.getByLabel(/email admin/i)).toBeVisible()
  await expect(page.getByLabel(/^password$/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in to dashboard/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /login as guest/i })).toBeVisible()
})

test("guest viewer can login but write controls stay disabled", async ({ page }) => {
  await login(page, guestEmail, guestPassword)

  await expect(page.getByText(/read-only mode/i)).toBeVisible()

  await page.goto("/dashboard/products")
  await expect(page.getByRole("button", { name: /\+ add product/i })).toBeDisabled()
  await expect(page.getByRole("button", { name: /delete selected/i })).toBeDisabled()

  await page.goto("/dashboard/stocks")
  await expect(page.getByRole("button", { name: /\+ add stock/i })).toBeDisabled()
  await expect(page.getByRole("button", { name: /delete bulk/i })).toBeDisabled()
  await expect(page.getByRole("button", { name: /bulk upload/i })).toBeDisabled()

  await page.goto("/dashboard/settings/backup")
  await expect(page.getByRole("button", { name: /run critical/i })).toBeDisabled()
  await expect(page.getByRole("button", { name: /run full/i })).toBeDisabled()
})

test("guest viewer write API is rejected", async ({ page }) => {
  await login(page, guestEmail, guestPassword)

  const token = await getAccessToken(page)
  expect(token).toBeTruthy()

  const response = await page.request.post("/api/admin/products", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_code: "E2E_VIEWER_BLOCKED",
      name: "E2E Viewer Blocked",
      price_normal: 1,
      duration_days: 1,
    },
  })

  if (response.status() === 500) {
    const body = await response.text()
    test.skip(body.includes("Missing server env"), "Set SUPABASE_SERVICE_ROLE_KEY locally to verify API viewer write rejection.")
  }

  expect(response.status()).toBe(403)
})

test.describe("authenticated admin smoke", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated smoke tests.")

  test("admin can login and open core pages", async ({ page }) => {
    await login(page, adminEmail || "", adminPassword || "")
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()

    for (const path of [
      "/dashboard/products",
      "/dashboard/stocks",
      "/dashboard/tickets",
      "/dashboard/settings/backup",
      "/dashboard/error-logs",
    ]) {
      await page.goto(path)
      await expect(page.locator("body")).toContainText(/INSIGHT|Products|Stock|Tickets|Backup|Error Logs/i)
    }
  })

  test("admin write API reaches validation layer", async ({ page }) => {
    test.skip(!runWriteFlow, "Set E2E_WRITE_FLOW=true to run admin write-flow validation.")

    await login(page, adminEmail || "", adminPassword || "")
    const token = await getAccessToken(page)
    expect(token).toBeTruthy()

    const response = await page.request.post("/api/admin/products", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_code: "",
        name: "",
        price_normal: 0,
        duration_days: 0,
      },
    })

    expect(response.status()).toBe(400)
    await expect(async () => {
      const body = await response.json()
      expect(String(body.error || "")).toMatch(/gagal|wajib|valid/i)
    }).toPass()
  })
})
