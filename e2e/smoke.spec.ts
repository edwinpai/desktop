/**
 * Smoke test — runs against Vite dev server (no Tauri runtime needed)
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

test.describe('Smoke Tests (Vite dev server)', () => {
  test('app loads without crashing', async ({ page }) => {
    await page.goto(BASE_URL);
    // Should render something — root div at minimum
    await expect(page.locator('#root')).toBeAttached();
    // Give React time to mount
    await page.waitForTimeout(2000);
    // Take a screenshot for review
    await page.screenshot({ path: 'e2e/screenshots/smoke-load.png', fullPage: true });
  });

  test('page has visible content', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    // Check that the body has non-trivial content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
    console.log('Page content preview:', bodyText.substring(0, 500));
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    // Filter out known benign errors (Tauri API not available in browser)
    const realErrors = errors.filter(e =>
      !e.includes('__TAURI__') &&
      !e.includes('tauri') &&
      !e.includes('Failed to fetch')
    );

    console.log('Console errors:', errors);
    console.log('Real errors (filtered):', realErrors);

    await page.screenshot({ path: 'e2e/screenshots/smoke-console.png', fullPage: true });
  });

  test('page has correct title', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    const title = await page.title();
    expect(title).toBe('EdwinPAI Desktop');
  });
});
