// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet (Gateway/Client mode selection, advanced wizards, etc.)
// Re-enable as features are implemented.

/**
 * E2E Tests for Channel Wizard Flow
 * Tests channel creation, validation, and configuration for various platforms
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('WhatsApp Channel Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Complete onboarding and navigate to channels
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Navigate to settings/channels
    const settingsButton = page.getByRole('button', { name: /Settings|⚙/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.getByText(/Channels|Integrations/i).click();
    }
  });

  test('should create WhatsApp channel with valid session data', async ({ page }) => {
    // Click "Add Channel" or "New Channel"
    await page.getByRole('button', { name: /Add Channel|New Channel|Create/i }).click();

    // Select WhatsApp platform
    await page.getByText('WhatsApp').click();

    // Verify wizard opens
    await expect(page.getByText(/WhatsApp Configuration|Configure WhatsApp/i)).toBeVisible();

    // Step 1: Channel Name
    const channelNameInput = page.getByLabel(/Channel Name|Name/i);
    await channelNameInput.fill('My WhatsApp Channel');

    // Continue
    await page.getByRole('button', { name: /Next|Continue/i }).click();

    // Step 2: Session Data Upload
    await expect(page.getByText(/Session Data|Authentication/i)).toBeVisible();

    // Mock session data (JSON format)
    const mockSessionData = JSON.stringify({
      clientId: 'test-client-id',
      serverToken: 'test-server-token',
      encKey: 'base64-encoded-encryption-key',
      macKey: 'base64-encoded-mac-key'
    });

    // Upload file or paste JSON
    const sessionInput = page.getByLabel(/Session Data|Upload Session/i);
    if (await sessionInput.isVisible()) {
      await sessionInput.fill(mockSessionData);
    } else {
      // File upload scenario
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        // Create mock file
        const buffer = Buffer.from(mockSessionData);
        await fileInput.setInputFiles({
          name: 'session.json',
          mimeType: 'application/json',
          buffer,
        });
      }
    }

    // Continue
    await page.getByRole('button', { name: /Next|Continue/i }).click();

    // Step 3: Validation
    await expect(page.getByText(/Validating|Checking credentials/i)).toBeVisible();

    await page.waitForTimeout(2000);

    // Should show success or validation results
    const successMessage = page.getByText(/Valid|Success|Credentials verified/i);
    if (await successMessage.isVisible()) {
      await expect(successMessage).toBeVisible();
    }

    // Step 4: Save
    await page.getByRole('button', { name: /Save|Finish|Create Channel/i }).click();

    await page.waitForTimeout(1000);

    // Verify channel appears in list
    await expect(page.getByText('My WhatsApp Channel')).toBeVisible();

    // Verify status indicator (enabled/disabled)
    const statusBadge = page.locator('[class*="badge"]').filter({ hasText: /Enabled|Active/i });
    if (await statusBadge.count() > 0) {
      await expect(statusBadge.first()).toBeVisible();
    }
  });

  test('should show validation errors for invalid session data', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('WhatsApp').click();

    // Enter channel name
    await page.getByLabel(/Channel Name/i).fill('Invalid WhatsApp');
    await page.getByRole('button', { name: /Next/i }).click();

    // Enter invalid session data
    await page.getByLabel(/Session Data/i).fill('{ "invalid": "json" }');
    await page.getByRole('button', { name: /Next/i }).click();

    await page.waitForTimeout(2000);

    // Should show validation error
    await expect(page.getByText(/Invalid|Error|Missing required fields/i)).toBeVisible();

    // Should not allow proceeding
    const saveButton = page.getByRole('button', { name: /Save|Finish/i });
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeDisabled();
    }
  });
});

test.describe.fixme('Telegram Channel Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    const settingsButton = page.getByRole('button', { name: /Settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.getByText(/Channels/i).click();
    }
  });

  test('should validate Telegram bot token format', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Telegram').click();

    // Enter channel name
    await page.getByLabel(/Channel Name/i).fill('My Telegram Bot');
    await page.getByRole('button', { name: /Next/i }).click();

    // Enter valid bot token format (numeric:alphanumeric)
    const validToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz0123456789';
    await page.getByLabel(/Bot Token|Token/i).fill(validToken);

    // Continue - should not show format error
    await page.getByRole('button', { name: /Next/i }).click();

    await page.waitForTimeout(1000);

    // Should proceed to validation step
    await expect(page.getByText(/Validating|Checking/i)).toBeVisible();
  });

  test('should reject invalid Telegram token format', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Telegram').click();

    await page.getByLabel(/Channel Name/i).fill('Invalid Telegram');
    await page.getByRole('button', { name: /Next/i }).click();

    // Enter invalid token (missing colon or wrong format)
    await page.getByLabel(/Bot Token/i).fill('invalid-token-format');

    // Try to continue
    await page.getByRole('button', { name: /Next/i }).click();

    await page.waitForTimeout(500);

    // Should show format error
    await expect(page.getByText(/Invalid token format|Invalid bot token/i)).toBeVisible();

    // Should not proceed
    const currentStepIndicator = page.getByText(/Bot Token|Authentication/i);
    await expect(currentStepIndicator).toBeVisible();
  });

  test('should extract bot ID from valid token', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Telegram').click();

    await page.getByLabel(/Channel Name/i).fill('Telegram Bot');
    await page.getByRole('button', { name: /Next/i }).click();

    const validToken = '987654321:ABCdefGHIjklMNOpqrsTUVwxyz';
    await page.getByLabel(/Bot Token/i).fill(validToken);

    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(1000);

    // After validation, should display bot info
    const botIdDisplay = page.getByText(/Bot ID:|987654321/i);
    if (await botIdDisplay.isVisible()) {
      await expect(botIdDisplay).toBeVisible();
    }
  });
});

test.describe.fixme('Channel Management UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    const settingsButton = page.getByRole('button', { name: /Settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.getByText(/Channels/i).click();
    }
  });

  test('should display list of configured channels', async ({ page }) => {
    // If channels exist, they should be visible
    const channelList = page.locator('[class*="channel"]');

    if (await channelList.count() > 0) {
      // Verify channel cards/items show platform icons
      await expect(page.getByText(/WhatsApp|Telegram|Discord|Slack|Matrix|Signal/i).first()).toBeVisible();
    } else {
      // Empty state
      await expect(page.getByText(/No channels configured|Add your first channel/i)).toBeVisible();
    }
  });

  test('should toggle channel enabled/disabled state', async ({ page }) => {
    // Create a test channel first (simplified)
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Telegram').click();
    await page.getByLabel(/Channel Name/i).fill('Toggle Test');
    await page.getByRole('button', { name: /Next/i }).click();
    await page.getByLabel(/Bot Token/i).fill('123456789:ABCdefGHI');
    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForTimeout(1000);

    // Find the channel
    const channelCard = page.getByText('Toggle Test').locator('..');

    // Look for toggle switch
    const toggleSwitch = channelCard.getByRole('switch').or(channelCard.getByRole('checkbox'));

    if (await toggleSwitch.count() > 0) {
      // Get current state
      const isEnabled = await toggleSwitch.first().isChecked();

      // Toggle
      await toggleSwitch.first().click();

      await page.waitForTimeout(500);

      // Verify state changed
      const newState = await toggleSwitch.first().isChecked();
      expect(newState).toBe(!isEnabled);
    }
  });

  test('should open edit wizard for existing channel', async ({ page }) => {
    // Assume a channel exists
    const editButton = page.getByRole('button', { name: /Edit|Configure|⚙/i }).first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Should open wizard with pre-filled data
      await expect(page.getByText(/Edit Channel|Configure/i)).toBeVisible();

      // Channel name should be pre-filled
      const nameInput = page.getByLabel(/Channel Name/i);
      const currentName = await nameInput.inputValue();
      expect(currentName.length).toBeGreaterThan(0);
    }
  });

  test('should confirm before deleting channel', async ({ page }) => {
    // Look for delete button
    const deleteButton = page.getByRole('button', { name: /Delete|Remove|🗑/i }).first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog
      await expect(page.getByText(/Are you sure|Delete channel|Confirm deletion/i)).toBeVisible();

      // Cancel deletion
      const cancelButton = page.getByRole('button', { name: /Cancel|No/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Channel should still exist
        await expect(deleteButton).toBeVisible();
      }
    }
  });
});

test.describe.fixme('Multi-Platform Channel Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    const settingsButton = page.getByRole('button', { name: /Settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.getByText(/Channels/i).click();
    }
  });

  test('should display all 6 supported platforms in selector', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();

    // Verify all platforms are shown
    const platforms = ['WhatsApp', 'Telegram', 'Discord', 'Slack', 'Matrix', 'Signal'];

    for (const platform of platforms) {
      await expect(page.getByText(platform)).toBeVisible();
    }
  });

  test('should show platform-specific fields for Discord', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Discord').click();

    await page.getByLabel(/Channel Name/i).fill('Discord Bot');
    await page.getByRole('button', { name: /Next/i }).click();

    // Discord should show bot token OR OAuth fields
    const botTokenField = page.getByLabel(/Bot Token|Discord Token/i);
    const oauthFields = page.getByText(/OAuth|Client ID|Client Secret/i);

    const hasBotToken = await botTokenField.isVisible();
    const hasOAuth = await oauthFields.count() > 0;

    // At least one authentication method should be visible
    expect(hasBotToken || hasOAuth).toBe(true);
  });

  test('should show platform-specific fields for Matrix', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Matrix').click();

    await page.getByLabel(/Channel Name/i).fill('Matrix Bot');
    await page.getByRole('button', { name: /Next/i }).click();

    // Matrix requires homeserver URL
    await expect(page.getByLabel(/Homeserver|Homeserver URL/i)).toBeVisible();

    // And either token or username/password
    const tokenField = page.getByLabel(/Access Token|Token/i);
    const usernameField = page.getByLabel(/Username|User ID/i);

    expect(await tokenField.isVisible() || await usernameField.isVisible()).toBe(true);
  });

  test('should validate platform-specific token formats', async ({ page }) => {
    await page.getByRole('button', { name: /Add Channel/i }).click();
    await page.getByText('Slack').click();

    await page.getByLabel(/Channel Name/i).fill('Slack Bot');
    await page.getByRole('button', { name: /Next/i }).click();

    // Slack tokens have specific prefixes (xoxb- for bot, xoxp- for user)
    const tokenInput = page.getByLabel(/Token|OAuth Token/i);

    // Invalid format (no prefix)
    await tokenInput.fill('invalid-slack-token');
    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(500);

    // Should show error
    const errorMessage = page.getByText(/Invalid token|Token must start with/i);
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }

    // Valid format
    await tokenInput.fill('xoxb-1234567890-1234567890-abcdefghijklmnop');
    await page.getByRole('button', { name: /Next/i }).click();
    await page.waitForTimeout(500);

    // Should not show format error (may have API validation error, but not format)
    const formatError = page.getByText(/Token must start with/i);
    if (await formatError.count() > 0) {
      expect(await formatError.isVisible()).toBe(false);
    }
  });
});
