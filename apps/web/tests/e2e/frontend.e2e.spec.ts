import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('serves the published homepage without browser errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))

    const response = await page.goto('/')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Acme Commerce/i)
    // Pages own their chrome since the granular swap: the layout's copy is
    // suppressed (display:none) and the visible chrome comes from the
    // SiteHeaderBlock/SiteFooterBlock content. Those render inside <main>, so
    // per ARIA they are deliberately NOT banner/contentinfo landmarks —
    // assert on the elements. Exactly one visible each, so a double-chrome
    // regression fails loudly.
    await expect(page.locator('header:visible')).toHaveCount(1)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('footer:visible')).toHaveCount(1)
    // The blueprint home is the shop: split hero + the two catalogue rows.
    await expect(page.getByRole('heading', { name: 'Real orbitlabs research, not marketing hype.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Research reagents, made and tested in the USA.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Particles', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reagents', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('serves all published pages and 404s deleted slugs', async ({ request }) => {
    // The platform routes are the blueprint set; `/courses/` was the legacy
    // route and is preserved only as an unpublished TEST reference.
    for (const path of ['/about/', '/community/', '/learn/', '/orbit/', '/vertex/', '/vertex-catalogue/']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
    }
    for (const path of ['/new', '/browser-test-page', '/courses/', '/products/']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(404)
    }
  })

  test('health and session endpoints are stable', async ({ request }) => {
    await expect.poll(async () => (await request.get('/api/health')).status()).toBe(200)
    const session = await request.get('/api/auth/session')
    expect(session.status()).toBe(200)
    expect(await session.json()).toEqual(null)
  })

  test('adds, persists, updates, and removes a Vendure cart item', async ({ page }) => {
    // The one priced product in the real catalogue (reagents stay unpriced
    // and unsellable until the owner sets prices).
    await page.goto('/products/orbit-cmpa-particles-10/')
    await page.getByRole('button', { name: 'Add to Cart — $30.00' }).click()
    await expect(page.getByText('Added to cart')).toBeVisible()

    await page.goto('/cart/')
    await expect(page.getByRole('heading', { name: 'Orbit® CMP-A Particles 10%' })).toBeVisible()
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await expect(page.getByLabel('Quantity for Orbit® CMP-A Particles 10%')).toContainText('2')
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
  })

  test('renders a responsive BTCPay checkout for an active cart', async ({ page }) => {
    await page.goto('/products/orbit-cmpa-particles-10/')
    await page.getByRole('button', { name: 'Add to Cart — $30.00' }).click()
    // Wait for the server-confirmed cart state before navigating — the message
    // only appears after the Vendure addItemToOrder mutation resolves. Navigating
    // immediately raced the mutation and intermittently produced an empty cart.
    await expect(page.getByText('Added to cart')).toBeVisible()
    await page.goto('/checkout/')

    await expect(page.getByRole('heading', { name: 'Shipping details' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to BTCPay Server' })).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'Order summary' })).toBeVisible()
    await expect(page.getByText('$30.00').first()).toBeVisible()
  })

  test('mobile layout has navigation and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    // The layout's suppressed chrome keeps a hidden hamburger in the DOM;
    // exactly one visible one must remain (the block-owned header's).
    await expect(page.getByLabel('Open navigation menu').locator('visible=true')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Real orbitlabs research, not marketing hype.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('SSO begins at the browser-reachable Authentik flow', async ({ page }) => {
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Sign in with Authentik' }).click()
    await expect(page).toHaveURL(/^http:\/\/localhost:7778\/if\/flow\//)
    await expect(page.getByRole('heading', { name: 'Welcome to authentik!' })).toBeVisible()
  })
})
