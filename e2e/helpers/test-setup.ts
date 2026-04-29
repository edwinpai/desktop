/**
 * Test Setup and Helper Utilities for E2E Tests
 * Provides common setup patterns and page object helpers
 */

import { Page, expect } from '@playwright/test';

/**
 * Page Object: Onboarding Flow
 */
export class OnboardingPage {
  constructor(private page: Page) {}

  async selectMode(mode: 'gateway' | 'client') {
    const modeText = mode === 'gateway' ? 'Gateway Mode' : 'Client Mode';
    await this.page.getByRole('button', { name: new RegExp(modeText, 'i') }).click();
  }

  async completeGatewaySetup(port = '8080') {
    // Generate identity
    const generateButton = this.page.getByRole('button', { name: /Generate Identity|Create Identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await this.page.waitForTimeout(1000);
      await this.page.getByRole('button', { name: /Continue|Next/i }).click();
    }

    // Configure port
    const portInput = this.page.getByLabel(/Port|Gateway Port/i);
    if (await portInput.isVisible()) {
      await portInput.fill(port);
    }

    // Start gateway
    await this.page.getByRole('button', { name: /Start Gateway|Launch Gateway/i }).click();
    await this.page.waitForTimeout(3000);
  }

  async completeClientSetup() {
    // Wait for discovery
    await this.page.waitForTimeout(2000);

    // Select first gateway
    const selectButton = this.page.getByRole('button', { name: /Select|Connect/i }).first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await this.page.getByRole('button', { name: /Connect|Confirm/i }).click();
      await this.page.waitForTimeout(3000);
    }
  }
}

/**
 * Page Object: Chat Interface
 */
export class ChatPage {
  constructor(private page: Page) {}

  async sendMessage(message: string) {
    const chatInput = this.page.getByPlaceholder(/Type a message|Send a message/i);
    await chatInput.fill(message);

    const sendButton = this.page.getByRole('button', { name: /Send|Submit/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }
  }

  async waitForResponse(timeout = 5000) {
    await this.page.waitForTimeout(timeout);
  }

  async verifyMessageExists(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async clearHistory() {
    const clearButton = this.page.getByRole('button', { name: /Clear|Clear History/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();

      // Confirm if dialog appears
      const confirmButton = this.page.getByRole('button', { name: /Confirm|Yes|Delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await this.page.waitForTimeout(500);
    }
  }
}

/**
 * Page Object: Settings
 */
export class SettingsPage {
  constructor(private page: Page) {}

  async open() {
    const settingsButton = this.page.getByRole('button', { name: /Settings|⚙/i });
    await settingsButton.click();
  }

  async navigateTo(section: string) {
    await this.page.getByText(new RegExp(section, 'i')).click();
  }

  async close() {
    const closeButton = this.page.getByRole('button', { name: /Close|✕/i });
    await closeButton.click();
    await this.page.waitForTimeout(500);
  }

  async saveChanges() {
    await this.page.getByRole('button', { name: /Save|Apply/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async setGatewayPort(port: string) {
    const portInput = this.page.getByLabel(/Port|Gateway Port/i);
    await portInput.fill(port);
  }

  async setPetname(petname: string) {
    const petnameInput = this.page.getByLabel(/Petname|Display Name/i);
    await petnameInput.fill(petname);
  }

  async switchMode(mode: 'gateway' | 'client') {
    const modeSelector = this.page.getByLabel(/Mode|Operation Mode/i);
    if (await modeSelector.isVisible()) {
      await modeSelector.selectOption(mode);
    }
  }
}

/**
 * Page Object: Channel Management
 */
export class ChannelsPage {
  constructor(private page: Page) {}

  async openChannelWizard() {
    await this.page.getByRole('button', { name: /Add Channel|New Channel|Create/i }).click();
  }

  async selectPlatform(platform: string) {
    await this.page.getByText(platform).click();
  }

  async fillChannelName(name: string) {
    const nameInput = this.page.getByLabel(/Channel Name|Name/i);
    await nameInput.fill(name);
  }

  async nextStep() {
    await this.page.getByRole('button', { name: /Next|Continue/i }).click();
  }

  async saveChannel() {
    await this.page.getByRole('button', { name: /Save|Finish|Create Channel/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async fillTelegramToken(token: string) {
    const tokenInput = this.page.getByLabel(/Bot Token|Token/i);
    await tokenInput.fill(token);
  }

  async fillWhatsAppSession(sessionData: object) {
    const sessionInput = this.page.getByLabel(/Session Data|Upload Session/i);
    if (await sessionInput.isVisible()) {
      await sessionInput.fill(JSON.stringify(sessionData));
    }
  }

  async toggleChannel(channelName: string) {
    const channelCard = this.page.getByText(channelName).locator('..');
    const toggleSwitch = channelCard.getByRole('switch').or(channelCard.getByRole('checkbox'));
    if (await toggleSwitch.count() > 0) {
      await toggleSwitch.first().click();
      await this.page.waitForTimeout(500);
    }
  }

  async deleteChannel(channelName: string, confirm = true) {
    const channelCard = this.page.getByText(channelName).locator('..');
    const deleteButton = channelCard.getByRole('button', { name: /Delete|Remove|🗑/i });

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Handle confirmation
      if (confirm) {
        const confirmButton = this.page.getByRole('button', { name: /Confirm|Yes|Delete/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      } else {
        const cancelButton = this.page.getByRole('button', { name: /Cancel|No/i });
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        }
      }

      await this.page.waitForTimeout(500);
    }
  }
}

/**
 * Test Data Factories
 */
export const TestData = {
  validTelegramToken: () => {
    const botId = Math.floor(Math.random() * 1000000000);
    const token = 'ABCdefGHIjklMNOpqrsTUVwxyz0123456789';
    return `${botId}:${token}`;
  },

  validWhatsAppSession: () => ({
    clientId: 'test-client-' + Date.now(),
    serverToken: 'test-server-token-' + Date.now(),
    encKey: Buffer.from('encryption-key-' + Date.now()).toString('base64'),
    macKey: Buffer.from('mac-key-' + Date.now()).toString('base64'),
  }),

  validSlackToken: () => {
    const suffix = Math.random().toString(36).substring(2, 15);
    return `xoxb-1234567890-1234567890-${suffix}`;
  },

  uniqueChannelName: (platform: string) => {
    return `${platform} Channel ${Date.now()}`;
  },
};

/**
 * Wait for Gateway to Start
 */
export async function waitForGatewayReady(page: Page, timeout = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await page.evaluate(async () => {
      // @ts-ignore
      if (window.__TAURI__) {
        try {
          // @ts-ignore
          const health = await window.__TAURI__.invoke('get_gateway_health');
          return health.status === 'running';
        } catch {
          return false;
        }
      }
      return false;
    });

    if (status) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

/**
 * Mock User Role
 */
export async function setMockUserRole(page: Page, role: 'owner' | 'member' | 'guest') {
  await page.evaluate((r) => {
    // @ts-ignore
    window.__EDWINPAI_USER_ROLE__ = r;
  }, role);
}

/**
 * Get Configuration from Backend
 */
export async function getConfig(page: Page) {
  return await page.evaluate(async () => {
    // @ts-ignore
    if (window.__TAURI__) {
      try {
        // @ts-ignore
        return await window.__TAURI__.invoke('get_config');
      } catch (e) {
        console.error('Failed to get config:', e);
        return null;
      }
    }
    return null;
  });
}

/**
 * Clear localStorage (chat history, etc.)
 */
export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Seed Chat History
 */
export async function seedChatHistory(page: Page, messages: Array<{ role: string; content: string }>) {
  const history = {
    messages: messages.map((msg, idx) => ({
      id: String(idx + 1),
      role: msg.role,
      content: msg.content,
      timestamp: Date.now() - (messages.length - idx) * 1000,
    })),
  };

  await page.evaluate((h) => {
    localStorage.setItem('edwinpai_chat_history', JSON.stringify(h));
  }, history);
}

/**
 * Setup Complete Environment
 * Quick setup for tests that need a fully initialized app
 */
export async function setupCompleteEnvironment(page: Page, mode: 'gateway' | 'client' = 'gateway') {
  await page.goto('tauri://localhost');

  const onboarding = new OnboardingPage(page);
  await onboarding.selectMode(mode);

  if (mode === 'gateway') {
    await onboarding.completeGatewaySetup();
  } else {
    await onboarding.completeClientSetup();
  }

  // Wait for ready state
  await page.waitForTimeout(1000);

  // Verify chat interface is ready
  await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible();
}
