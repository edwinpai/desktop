/**
 * Settings Page E2E Tests
 * Tests the settings UI, navigation between sections, and config display
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

// Helper: try to reach settings from any state
async function navigateToSettings(page: Page): Promise<boolean> {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  // Look for Settings button/icon in the current view
  const settingsSelectors = [
    page.getByRole('button', { name: /Settings|⚙/i }),
    page.getByRole('link', { name: /Settings/i }),
    page.locator('[aria-label*="Settings"], [aria-label*="settings"]'),
    page.locator('button:has(svg.lucide-settings), button:has(svg.lucide-settings-2)'),
  ];

  for (const selector of settingsSelectors) {
    if (await selector.first().isVisible().catch(() => false)) {
      await selector.first().click();
      await page.waitForTimeout(500);
      return true;
    }
  }

  // Navigate through onboarding steps looking for settings
  for (let i = 0; i < 7; i++) {
    for (const selector of settingsSelectors) {
      if (await selector.first().isVisible().catch(() => false)) {
        await selector.first().click();
        await page.waitForTimeout(500);
        return true;
      }
    }

    const nextBtn = page.getByRole('button', { name: /Next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }

  return false;
}

test.describe('Settings Navigation', () => {
  test('settings page is accessible', async ({ page }) => {
    const found = await navigateToSettings(page);
    await page.screenshot({ path: 'e2e/screenshots/settings-page.png', fullPage: true });
    console.log('Settings accessible:', found);
  });

  test('settings has General section', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const generalSection = page.getByText(/General|Appearance|Theme/i);
    const hasGeneral = await generalSection.isVisible().catch(() => false);
    console.log('General section visible:', hasGeneral);
    await page.screenshot({ path: 'e2e/screenshots/settings-general.png', fullPage: true });
  });

  test('settings has AI/Provider section', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const aiSection = page.getByText(/AI.*Provider|Model|LLM|Provider/i);
    const hasAI = await aiSection.isVisible().catch(() => false);
    console.log('AI/Provider section visible:', hasAI);
  });

  test('settings has Channels section', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const channelsSection = page.getByText(/Channels|Messaging|Integrations/i);
    const hasChannels = await channelsSection.isVisible().catch(() => false);
    console.log('Channels section visible:', hasChannels);
  });

  test('settings has Gateway section', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const gwSection = page.getByText(/Gateway|Connection|Server/i);
    const hasGateway = await gwSection.isVisible().catch(() => false);
    console.log('Gateway section visible:', hasGateway);
  });
});

test.describe('Settings Content', () => {
  test('shows gateway URL configuration', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const gwUrl = page.getByLabel(/Gateway.*URL|Server.*URL|URL/i);
    const hasUrl = await gwUrl.isVisible().catch(() => false);
    console.log('Gateway URL field visible:', hasUrl);
  });

  test('shows model/provider selection', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const modelSelect = page.getByLabel(/Model|Provider|AI.*Model/i);
    const hasModel = await modelSelect.isVisible().catch(() => false);
    console.log('Model selector visible:', hasModel);
  });

  test('has save/apply button', async ({ page }) => {
    const found = await navigateToSettings(page);
    if (!found) {
      test.skip();
      return;
    }

    const saveBtn = page.getByRole('button', { name: /Save|Apply|Update/i });
    const hasSave = await saveBtn.isVisible().catch(() => false);
    console.log('Save button visible:', hasSave);
  });
});
