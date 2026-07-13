import { expect, test } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test("login page renders admin form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible()
  await expect(page.getByLabel(/email admin/i)).toBeVisible()
  await expect(page.getByLabel(/^password$/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in to dashboard/i })).toBeVisible()
})

test.describe("authenticated admin smoke", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated smoke tests.")

  test("admin can login and open core pages", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email admin/i).fill(adminEmail || "")
    await page.getByLabel(/^password$/i).fill(adminPassword || "")
    await page.getByRole("button", { name: /sign in to dashboard/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
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
})
