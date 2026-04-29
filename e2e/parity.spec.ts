/**
 * Feature Parity Tests
 *
 * These tests document missing config fields in the desktop UI.
 * Tests use test.fixme() to mark them as known missing features.
 * As features are implemented, remove the fixme() and these tests should pass.
 *
 * See docs/FEATURE-PARITY-AUDIT.md for the full gap analysis.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

// Helper: navigate through onboarding to find channel config editor
async function findChannelConfigUI(page: Page): Promise<boolean> {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  // Navigate through all 7 steps looking for settings/config
  for (let i = 0; i < 7; i++) {
    const bodyText = await page.locator('body').innerText();

    // Look for settings or channel configuration
    if (/settings|configure|channel.*settings|config.*editor/i.test(bodyText)) {
      return true;
    }

    const nextBtn = page.getByRole('button', { name: /Next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Also try clicking any Settings button/link
  const settingsBtn = page.getByRole('button', { name: /Settings|⚙|Gear/i });
  if (await settingsBtn.isVisible().catch(() => false)) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

test.describe('P0: Critical Missing Fields', () => {
  test.describe('Enabled Toggle', () => {
    test('Telegram config editor should have enabled toggle', async ({ page }) => {
      test.fixme(true, 'Channel config editor does not yet expose enabled toggle');

      await page.goto(BASE_URL);
      await page.waitForTimeout(1500);

      const bodyText = await page.locator('body').innerText();

      await findChannelConfigUI(page);
      const enabledToggle = page.getByLabel(/^Enabled$/i);
      const hasEnabled = await enabledToggle.isVisible().catch(() => false);
      expect(hasEnabled).toBeTruthy();
    });
  });

  test.describe('AllowFrom Fields', () => {
    test('Telegram config should expose allowFrom field', async ({ page }) => {
      test.fixme(true, 'Channel config editor does not yet expose allowFrom field');

      await findChannelConfigUI(page);
      const allowFromField = page.getByLabel(/Allow From|Allowed Users|Allowlist/i);
      const hasAllowFrom = await allowFromField.isVisible().catch(() => false);
      expect(hasAllowFrom).toBeTruthy();
    });

    test('Telegram config should expose groupAllowFrom field', async ({ page }) => {
      test.fixme(true, 'Channel config editor does not yet expose groupAllowFrom field');

      await findChannelConfigUI(page);
      const groupAllowFrom = page.getByLabel(/Group Allow|Group Allowlist/i);
      const hasField = await groupAllowFrom.isVisible().catch(() => false);
      expect(hasField).toBeTruthy();
    });
  });

  test.describe('History Limits', () => {
    test('Telegram config should expose historyLimit field', async ({ page }) => {
      test.fixme(true, 'Channel config editor does not yet expose historyLimit field');

      await findChannelConfigUI(page);
      const historyField = page.getByLabel(/History Limit|Max History|Context.*Limit/i);
      const hasField = await historyField.isVisible().catch(() => false);
      expect(hasField).toBeTruthy();
    });

    test('Telegram config should expose dmHistoryLimit field', async ({ page }) => {
      test.fixme(true, 'Channel config editor does not yet expose dmHistoryLimit field');

      await findChannelConfigUI(page);
      const dmHistoryField = page.getByLabel(/DM History|DM.*Limit/i);
      const hasField = await dmHistoryField.isVisible().catch(() => false);
      expect(hasField).toBeTruthy();
    });
  });
});

test.describe('P1: Important Missing Fields', () => {
  test('Telegram config should expose streamMode selector', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose streamMode selector');

    await findChannelConfigUI(page);
    const streamField = page.getByLabel(/Stream.*Mode|Streaming/i);
    const hasField = await streamField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('Telegram config should expose reactionLevel selector', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose reactionLevel selector');

    await findChannelConfigUI(page);
    const reactionField = page.getByLabel(/Reaction.*Level|Reactions/i);
    const hasField = await reactionField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('Telegram config should expose replyToMode selector', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose replyToMode selector');

    await findChannelConfigUI(page);
    const replyField = page.getByLabel(/Reply.*Mode|Reply Threading/i);
    const hasField = await replyField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('Discord config should expose allowBots toggle', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose allowBots toggle');

    await findChannelConfigUI(page);
    const allowBotsField = page.getByLabel(/Allow.*Bots/i);
    const hasField = await allowBotsField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('Slack config should expose userToken field', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose userToken field');

    await findChannelConfigUI(page);
    const userTokenField = page.getByLabel(/User Token/i);
    const hasField = await userTokenField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('WhatsApp config should expose selfChatMode toggle', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet expose selfChatMode toggle');

    await findChannelConfigUI(page);
    const selfChatField = page.getByLabel(/Self.*Chat|Same.*Phone/i);
    const hasField = await selfChatField.isVisible().catch(() => false);
    expect(hasField).toBeTruthy();
  });

  test('config editor should have Actions section', async ({ page }) => {
    test.fixme(true, 'Channel config editor does not yet have Actions section');

    await findChannelConfigUI(page);
    const actionsSection = page.getByText(/Actions|Capabilities|Permissions/i);
    const hasSection = await actionsSection.isVisible().catch(() => false);
    expect(hasSection).toBeTruthy();
  });

  test('Telegram wizard should collect allowFrom during setup', async ({ page }) => {
    test.fixme(true, 'Telegram wizard does not yet collect allowFrom during setup');

    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    // Navigate to channel step and open Telegram
    for (let i = 0; i < 7; i++) {
      const telegramEl = page.getByText('Telegram').first();
      if (await telegramEl.isVisible().catch(() => false)) {
        await telegramEl.click();
        await page.waitForTimeout(500);
        break;
      }
      const nextBtn = page.getByRole('button', { name: /Next/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Walk through all wizard steps looking for allowFrom
    let foundAllowFrom = false;
    for (let i = 0; i < 6; i++) {
      const allowFromField = page.getByLabel(/Allow From|Allowed Users/i);
      if (await allowFromField.isVisible().catch(() => false)) {
        foundAllowFrom = true;
        break;
      }
      const nextBtn = page.getByRole('button', { name: /Next|Continue/i }).first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }
    expect(foundAllowFrom).toBeTruthy();
  });
});

test.describe('Setup Wizard Completeness', () => {
  test('Telegram wizard should have more than just botToken', async ({ page }) => {
    test.fixme(true, 'Telegram wizard currently only has botToken field');

    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    // Find and count input fields across all Telegram wizard steps
    for (let i = 0; i < 7; i++) {
      const telegramEl = page.getByText('Telegram').first();
      if (await telegramEl.isVisible().catch(() => false)) {
        await telegramEl.click();
        await page.waitForTimeout(500);
        break;
      }
      const nextBtn = page.getByRole('button', { name: /Next/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Count unique input fields across wizard steps
    const fieldLabels = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const labels = page.locator('label');
      const count = await labels.count();
      for (let j = 0; j < count; j++) {
        const text = await labels.nth(j).textContent().catch(() => '');
        if (text) fieldLabels.add(text);
      }
      const nextBtn = page.getByRole('button', { name: /Next|Continue/i }).first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    console.log('Telegram wizard fields found:', [...fieldLabels]);
    expect(fieldLabels.size).toBeGreaterThanOrEqual(3);
  });

  test('Discord wizard should have more than just token', async ({ page }) => {
    test.fixme(true, 'Discord wizard currently only has token field');

    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    for (let i = 0; i < 7; i++) {
      const discordEl = page.getByText('Discord').first();
      if (await discordEl.isVisible().catch(() => false)) {
        await discordEl.click();
        await page.waitForTimeout(500);
        break;
      }
      const nextBtn = page.getByRole('button', { name: /Next/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const fieldLabels = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const labels = page.locator('label');
      const count = await labels.count();
      for (let j = 0; j < count; j++) {
        const text = await labels.nth(j).textContent().catch(() => '');
        if (text) fieldLabels.add(text);
      }
      const nextBtn = page.getByRole('button', { name: /Next|Continue/i }).first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    console.log('Discord wizard fields found:', [...fieldLabels]);
    expect(fieldLabels.size).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Config Editor Completeness', () => {
  test('Telegram config editor should have >= 8 editable fields', async ({ page }) => {
    test.fixme(true, 'Config editor currently has only 3 fields, needs at least 8');

    await findChannelConfigUI(page);

    const inputs = page.locator('input, select, [role="switch"], [role="combobox"]');
    const count = await inputs.count();
    console.log(`Config editor fields found: ${count}`);
    expect(count).toBeGreaterThanOrEqual(8);
  });
});
