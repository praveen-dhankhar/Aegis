import { expect, test } from '@playwright/test'

test('renders the Aegis shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Aegis Control Plane').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Sandbox/i })).toBeVisible()
})
