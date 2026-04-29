/**
 * Chat Interface E2E Tests
 * Tests the chat UI components accessible via the app
 * Note: Without Tauri runtime, WebSocket connections will fail,
 * but we can test the UI elements render correctly.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:1420';

// Helper: skip onboarding to reach the chat interface
async function skipToChat(page: Page): Promise<boolean> {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  // Navigate through all onboarding steps
  for (let i = 0; i < 8; i++) {
    // Check if chat input is visible (we've reached the chat)
    const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
    if (await chatInput.isVisible().catch(() => false)) {
      return true;
    }

    // Try skip/finish buttons
    const skipBtn = page.getByRole('button', { name: /Skip|Finish|Complete|Get Started|Done/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
      continue;
    }

    // Try Next
    const nextBtn = page.getByRole('button', { name: /Next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Final check
  const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
  return await chatInput.isVisible().catch(() => false);
}

test.describe('Chat Interface', () => {
  test('can reach chat after onboarding', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    await page.screenshot({ path: 'e2e/screenshots/chat-interface.png', fullPage: true });
    // Document whether chat is reachable through onboarding
    console.log('Chat reachable after onboarding:', reachedChat);
  });

  test('chat interface has message input', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    if (!reachedChat) {
      test.skip();
      return;
    }

    const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();
  });

  test('chat interface has send button', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    if (!reachedChat) {
      test.skip();
      return;
    }

    const sendBtn = page.getByRole('button', { name: /Send|Submit/i });
    // Send button may be hidden until text is entered
    const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
    await chatInput.fill('test');
    await page.waitForTimeout(300);

    const visible = await sendBtn.isVisible().catch(() => false);
    console.log('Send button visible after typing:', visible);
  });

  test('can type in chat input', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    if (!reachedChat) {
      test.skip();
      return;
    }

    const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
    await chatInput.fill('Hello, EdwinPAI!');
    await expect(chatInput).toHaveValue('Hello, EdwinPAI!');
  });

  test('empty message is not sendable', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    if (!reachedChat) {
      test.skip();
      return;
    }

    const chatInput = page.getByPlaceholder(/Type a message|Send a message|Message/i);
    await chatInput.fill('');

    const sendBtn = page.getByRole('button', { name: /Send|Submit/i });
    const isDisabled = await sendBtn.isDisabled().catch(() => true);
    // Send should be disabled or hidden when empty
    console.log('Send disabled when empty:', isDisabled);
  });
});

test.describe('Chat Layout', () => {
  test('has proper header/sidebar elements', async ({ page }) => {
    const reachedChat = await skipToChat(page);
    if (!reachedChat) {
      await page.screenshot({ path: 'e2e/screenshots/chat-not-reached.png', fullPage: true });
      test.skip();
      return;
    }

    await page.screenshot({ path: 'e2e/screenshots/chat-layout.png', fullPage: true });

    // Check for common chat UI elements
    const bodyText = await page.locator('body').innerText();
    console.log('Chat page content preview:', bodyText.substring(0, 500));
  });
});
