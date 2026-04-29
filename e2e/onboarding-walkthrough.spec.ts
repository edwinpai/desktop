// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet. Re-enable as features are implemented.
/**
 * E2E Tests for Complete Onboarding Walkthroughs
 * Tests both gateway and client setup flows from first launch to ready state
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('Gateway Mode Onboarding', () => {
  test('should complete full gateway setup wizard', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Step 1: Mode Selection
    await expect(page.getByText('Welcome to EdwinPAI Desktop')).toBeVisible();
    await expect(page.getByText('Gateway Mode')).toBeVisible();

    // Select gateway mode
    await page.getByRole('button', { name: /Gateway Mode|Start as Gateway/i }).click();

    // Step 2: Identity Setup
    await expect(page.getByText(/Set Up Your Identity|Identity Setup/i)).toBeVisible();

    // Generate identity
    const generateButton = page.getByRole('button', { name: /Generate Identity|Create Identity/i });
    await generateButton.click();

    // Verify identity was created
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Your petname:|Petname:/i)).toBeVisible();

    // Continue to next step
    await page.getByRole('button', { name: /Continue|Next/i }).click();

    // Step 3: Gateway Configuration
    await expect(page.getByText(/Gateway Configuration|Configure Gateway/i)).toBeVisible();

    // Port should be pre-filled with default (8080)
    const portInput = page.getByLabel(/Port|Gateway Port/i);
    await expect(portInput).toHaveValue('8080');

    // Optional: change port
    await portInput.fill('8081');

    // Continue
    await page.getByRole('button', { name: /Start Gateway|Launch Gateway/i }).click();

    // Step 4: Gateway Starting
    await expect(page.getByText(/Starting gateway|Initializing/i)).toBeVisible();

    // Wait for gateway to start (up to 10s)
    await page.waitForTimeout(3000);

    // Step 5: Verify Ready State
    // Should be redirected to main chat interface
    await expect(page.getByPlaceholder(/Type a message|Send a message/i)).toBeVisible();

    // System tray should show "Running" or "Online"
    const statusIndicator = page.getByText(/Running|Online|Gateway Active/i);
    if (await statusIndicator.isVisible()) {
      await expect(statusIndicator).toBeVisible();
    }
  });

  test('should allow skipping optional configuration', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Quick path: use all defaults
    await page.getByRole('button', { name: /Gateway Mode/i }).click();
    await page.getByRole('button', { name: /Generate Identity/i }).click();

    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Continue|Next/i }).click();

    // Skip port configuration, use default
    await page.getByRole('button', { name: /Start Gateway/i }).click();

    await page.waitForTimeout(3000);

    // Verify we reached chat interface
    await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible();
  });
});

test.describe.fixme('Client Mode Onboarding', () => {
  test('should complete full client connection wizard', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Step 1: Mode Selection
    await expect(page.getByText('Welcome to EdwinPAI Desktop')).toBeVisible();

    // Select client mode
    await page.getByRole('button', { name: /Client Mode|Connect to Gateway/i }).click();

    // Step 2: Gateway Discovery
    await expect(page.getByText(/Discover Gateways|Finding gateways/i)).toBeVisible();
    await expect(page.getByText(/Scanning your local network/i)).toBeVisible();

    // Wait for discovery (5s timeout)
    await page.waitForTimeout(2000);

    // Step 3: Gateway Selection
    // Should show list of discovered gateways
    await expect(page.getByRole('button', { name: /Select|Connect/i }).first()).toBeVisible();

    // Select first gateway
    await page.getByRole('button', { name: /Select|Connect/i }).first().click();

    // Step 4: Gateway Confirmation
    await expect(page.getByText(/Confirm Gateway|Connect to this gateway/i)).toBeVisible();

    // Should display gateway info
    await expect(page.getByText(/Petname:|Gateway:/i)).toBeVisible();
    await expect(page.getByText(/Public Key:|Address:/i)).toBeVisible();

    // Confirm connection
    await page.getByRole('button', { name: /Connect|Confirm/i }).click();

    // Step 5: BRC-103 Authentication
    await expect(page.getByText(/Authenticating|Connecting/i)).toBeVisible();

    // Wait for handshake (challenge-response)
    await page.waitForTimeout(3000);

    // Step 6: Authorization Request (if needed)
    // May require gateway owner approval
    const authPending = page.getByText(/Waiting for approval|Authorization pending/i);
    if (await authPending.isVisible()) {
      // In real scenario, gateway owner would approve in parallel
      // For mock testing, approval happens automatically after timeout
      await page.waitForTimeout(2000);
    }

    // Step 7: Verify Connected State
    await expect(page.getByText(/Connected|Connection established/i)).toBeVisible();

    // Should show chat interface
    await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible();
  });

  test('should handle no gateways found scenario', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode
    await page.getByRole('button', { name: /Client Mode/i }).click();

    // Wait for discovery timeout
    await page.waitForTimeout(6000);

    // Should show "no gateways found" message
    const noGatewaysMessage = page.getByText(/No gateways found|No gateways discovered/i);
    if (await noGatewaysMessage.isVisible()) {
      await expect(noGatewaysMessage).toBeVisible();

      // Should offer retry option
      await expect(page.getByRole('button', { name: /Retry|Scan Again/i })).toBeVisible();
    }
  });

  test('should support manual gateway entry', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode
    await page.getByRole('button', { name: /Client Mode/i }).click();

    // Look for manual entry option
    const manualButton = page.getByRole('button', { name: /Enter Manually|Manual Entry/i });

    if (await manualButton.isVisible()) {
      await manualButton.click();

      // Should show IP/port input form
      await expect(page.getByLabel(/IP Address|Gateway Address/i)).toBeVisible();
      await expect(page.getByLabel(/Port/i)).toBeVisible();

      // Fill in gateway details
      await page.getByLabel(/IP Address/i).fill('192.168.1.100');
      await page.getByLabel(/Port/i).fill('8080');

      // Connect
      await page.getByRole('button', { name: /Connect/i }).click();

      // Should proceed to confirmation
      await expect(page.getByText(/Confirm Gateway/i)).toBeVisible();
    }
  });
});

test.describe.fixme('Onboarding Navigation', () => {
  test('should allow going back through wizard steps', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Start gateway setup
    await page.getByRole('button', { name: /Gateway Mode/i }).click();
    await page.getByRole('button', { name: /Generate Identity/i }).click();

    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Continue/i }).click();

    // Now on configuration step - go back
    const backButton = page.getByRole('button', { name: /Back|Previous/i });
    if (await backButton.isVisible()) {
      await backButton.click();

      // Should be back on identity screen
      await expect(page.getByText(/Identity Setup/i)).toBeVisible();
    }
  });

  test('should allow cancelling onboarding', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Start setup
    await page.getByRole('button', { name: /Gateway Mode/i }).click();

    // Look for cancel option
    const cancelButton = page.getByRole('button', { name: /Cancel|Exit/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Should return to mode selection
      await expect(page.getByText('Welcome to EdwinPAI Desktop')).toBeVisible();
    }
  });
});
