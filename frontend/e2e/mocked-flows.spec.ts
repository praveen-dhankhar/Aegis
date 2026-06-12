import { expect, test, type Page } from '@playwright/test'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,x-admin-key,x-api-key,authorization',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

async function mockBase(page: Page) {
  await page.route('**/actuator/health', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ status: 'UP', components: { redis: { status: 'UP' } } }),
    })
  })
  await page.route('**/actuator/prometheus', async (route) => {
    await route.fulfill({
      contentType: 'text/plain',
      headers: corsHeaders,
      body: [
        'rate_limit_requests_total{client="demo-client",result="allowed",algorithm="SLIDING_WINDOW"} 10',
        'rate_limit_requests_total{client="demo-client",result="rejected",algorithm="SLIDING_WINDOW"} 2',
        'rate_limit_redis_latency_ms_seconds_max 0.004',
        'rate_limit_redis_errors_total 0',
      ].join('\n'),
    })
  })
}

test('read-only visitor can use sandbox and observe rejection', async ({ page }) => {
  await mockBase(page)
  await page.route('**/admin/rate-limits', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify([{ client_id: 'demo-client', algorithm: 'SLIDING_WINDOW', limit: 2, window_ms: 60000, burst_capacity: 2, fail_mode: 'OPEN' }]),
    })
  })
  let requestCount = 0
  await page.route('**/api/test', async (route) => {
    requestCount += 1
    const rejected = requestCount > 2
    await route.fulfill({
      status: rejected ? 429 : 200,
      contentType: 'application/json',
      headers: {
        ...corsHeaders,
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': rejected ? '0' : String(2 - requestCount),
        'x-ratelimit-reset': String(Date.now() + 60000),
        ...(rejected ? { 'retry-after': '60' } : {}),
      },
      body: JSON.stringify(rejected ? { error: 'rate_limit_exceeded' } : { status: 'ok' }),
    })
  })

  await page.goto('/sandbox')
  await page.getByLabel('Known client').selectOption('demo-client')
  await page.getByRole('button', { name: 'Fire 5', exact: true }).click()
  await expect(page.getByText(/Rejected 3/)).toBeVisible()
  await expect(page.getByRole('cell', { name: '429' }).first()).toBeVisible()
})

test('invalid admin key leaves write controls locked', async ({ page }) => {
  await mockBase(page)
  await page.route('**/admin/auth/validate', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ error: 'unauthorized' }) })
  })
  await page.goto('/login')
  await page.getByLabel('X-Admin-Key').fill('wrong')
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid admin key.')).toBeVisible()
})

test('admin can create edit and delete a rule', async ({ page }) => {
  await mockBase(page)
  const rules = new Map<string, Record<string, unknown>>()
  await page.route('**/admin/auth/validate', async (route) => {
    await route.fulfill({ status: 204, headers: corsHeaders })
  })
  await page.route('**/admin/rate-limits', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>
      rules.set(payload.client_id as string, payload)
      await route.fulfill({ status: 201, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(payload) })
      return
    }
    await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify([...rules.values()]) })
  })
  await page.route('**/admin/rate-limits/e2e-client', async (route) => {
    const request = route.request()
    if (request.method() === 'PUT') {
      const current = rules.get('e2e-client') ?? {}
      const updated = { ...current, ...request.postDataJSON(), client_id: 'e2e-client' }
      rules.set('e2e-client', updated)
      await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(updated) })
      return
    }
    if (request.method() === 'DELETE') {
      rules.delete('e2e-client')
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    await route.fulfill({ contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ client_id: 'e2e-client', config: rules.get('e2e-client'), stats: {} }) })
  })

  await page.goto('/login')
  await page.getByLabel('X-Admin-Key').fill('test-admin-key')
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('main').getByRole('button', { name: 'Create rule' }).click()
  await page.getByLabel('Client ID').fill('e2e-client')
  await page.getByRole('dialog').getByRole('button', { name: 'Create rule' }).click()
  await expect(page.getByText('e2e-client')).toBeVisible()

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel(/^Limit/).fill('7')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('cell', { name: '7' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete rule' }).click()
  await expect(page.getByRole('link', { name: 'e2e-client' })).not.toBeVisible()
})
