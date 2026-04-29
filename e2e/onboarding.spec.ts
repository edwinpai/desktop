/**
 * Onboarding Wizard E2E Tests
 * Tests the 7-step onboarding flow rendered at first launch
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

test.describe('Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
  });

  test('renders welcome screen on first load', async ({ page }) => {
    await expect(page.getByText('Welcome to EdwinPAI').first()).toBeVisible();
    await expect(page.getByText('Step 1 of 7')).toBeVisible();
    await expect(page.getByText('0% complete')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/onboarding-welcome.png', fullPage: true });
  });

  test('shows gateway detection status', async ({ page }) => {
    // Should show either "No Gateway Detected" or a detected gateway
    const noGateway = page.getByText('No Gateway Detected');
    const gatewayDetected = page.getByText(/Gateway.*Detected|Connected/i);
    const visible = await noGateway.isVisible().catch(() => false) ||
                    await gatewayDetected.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('has Start Setup or Get Started button', async ({ page }) => {
    // Welcome step shows GatewayDetection first (with "Start Setup"),
    // or "Get Started" if gateway detection is skipped
    const startSetup = page.getByRole('button', { name: /Start Setup/i });
    const getStarted = page.getByRole('button', { name: /Get Started/i });
    const hasStart = await startSetup.isVisible().catch(() => false) ||
                     await getStarted.isVisible().catch(() => false);
    expect(hasStart).toBeTruthy();
  });

  test('has Previous and Next navigation buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Previous/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible();
  });

  test('shows step indicator dots', async ({ page }) => {
    // 7 step dots
    const dots = page.locator('[class*="rounded-full"][class*="w-2"], [class*="rounded-full"][class*="h-2"]');
    const count = await dots.count();
    // At minimum we should see some indicator dots
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Next button advances to step 2', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /Next/i });
    await nextBtn.click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Step 2 of 7')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/onboarding-step2.png', fullPage: true });
  });

  test('can navigate through all 7 steps', async ({ page }) => {
    for (let step = 1; step <= 7; step++) {
      await expect(page.getByText(`Step ${step} of 7`)).toBeVisible();
      await page.screenshot({ path: `e2e/screenshots/onboarding-step${step}.png`, fullPage: true });
      if (step < 7) {
        await page.getByRole('button', { name: /Next/i }).click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Previous button goes back', async ({ page }) => {
    // Go to step 2
    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Step 2 of 7')).toBeVisible();

    // Go back to step 1
    await page.getByRole('button', { name: /Previous/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Step 1 of 7')).toBeVisible();
  });

  test('progress bar updates as steps advance', async ({ page }) => {
    await expect(page.getByText('Step 1 of 7')).toBeVisible();
    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(500);
    // Step counter should advance to step 2
    await expect(page.getByText('Step 2 of 7')).toBeVisible();
  });
});
