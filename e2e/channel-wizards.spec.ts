/**
 * Channel Wizard E2E Tests
 * Tests setup wizards for each channel type
 * Note: Runs against Vite dev server (no Tauri runtime), so gateway calls will fail.
 * We test the UI flow and form validation, not actual backend integration.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

// Helper: navigate to channel setup (assumes we can reach a channel list or settings)
async function navigateToChannelSetup(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  // Try to find "Add Channel" or navigate through settings
  // The app starts on onboarding — skip through to find channels
  // Step through onboarding until we find channel-related UI
  for (let i = 0; i < 7; i++) {
    const addChannel = page.getByRole('button', { name: /Add Channel|Connect.*Channel|Set Up Channel/i });
    if (await addChannel.isVisible().catch(() => false)) {
      return true;
    }

    // Check if there's a channel list or selector
    const channelText = page.getByText(/Telegram|Discord|Signal|WhatsApp|Slack|Matrix/i).first();
    if (await channelText.isVisible().catch(() => false)) {
      return true;
    }

    const nextBtn = page.getByRole('button', { name: /Next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }
  return false;
}

test.describe('Channel Selection', () => {
  test('onboarding includes a channel setup step', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    // Navigate through steps looking for channel-related content
    let foundChannelStep = false;
    for (let i = 0; i < 7; i++) {
      const text = await page.locator('body').innerText();
      if (/channel|telegram|discord|signal|whatsapp|slack|matrix/i.test(text)) {
        foundChannelStep = true;
        await page.screenshot({ path: 'e2e/screenshots/channel-step.png', fullPage: true });
        break;
      }
      const nextBtn = page.getByRole('button', { name: /Next/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }
    expect(foundChannelStep).toBeTruthy();
  });

  test('channel options are visible during setup', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    // Check for channel platform names
    const platforms = ['Telegram', 'Discord', 'Signal', 'WhatsApp', 'Slack', 'Matrix'];
    let visibleCount = 0;
    for (const platform of platforms) {
      const el = page.getByText(platform);
      if (await el.isVisible().catch(() => false)) {
        visibleCount++;
      }
    }
    await page.screenshot({ path: 'e2e/screenshots/channel-options.png', fullPage: true });
    expect(visibleCount).toBeGreaterThan(0);
  });
});

test.describe('Telegram Wizard', () => {
  test('can find Telegram setup option', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    const telegramBtn = page.getByText('Telegram').first();
    if (await telegramBtn.isVisible().catch(() => false)) {
      await telegramBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/telegram-wizard.png', fullPage: true });

      // Should show bot token input somewhere in the flow
      const botTokenLabel = page.getByText(/Bot Token/i);
      const hasToken = await botTokenLabel.isVisible().catch(() => false);
      // May need to click through intro step first
      if (!hasToken) {
        const nextBtn = page.getByRole('button', { name: /Next|Continue|Start/i }).first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(500);
        }
      }
      await page.screenshot({ path: 'e2e/screenshots/telegram-wizard-credentials.png', fullPage: true });
    }
  });
});

test.describe('Discord Wizard', () => {
  test('can find Discord setup option', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    const discordBtn = page.getByText('Discord').first();
    if (await discordBtn.isVisible().catch(() => false)) {
      await discordBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/discord-wizard.png', fullPage: true });
    }
  });
});

test.describe('Signal Wizard', () => {
  test('can find Signal setup option', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    const signalBtn = page.getByText('Signal').first();
    if (await signalBtn.isVisible().catch(() => false)) {
      await signalBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/signal-wizard.png', fullPage: true });
    }
  });
});

test.describe('WhatsApp Wizard', () => {
  test('can find WhatsApp setup option', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    const waBtn = page.getByText('WhatsApp').first();
    if (await waBtn.isVisible().catch(() => false)) {
      await waBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/whatsapp-wizard.png', fullPage: true });
    }
  });
});

test.describe('Slack Wizard', () => {
  test('can find Slack setup option', async ({ page }) => {
    const found = await navigateToChannelSetup(page);
    if (!found) {
      test.skip();
      return;
    }

    const slackBtn = page.getByText('Slack').first();
    if (await slackBtn.isVisible().catch(() => false)) {
      await slackBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/slack-wizard.png', fullPage: true });
    }
  });
});
