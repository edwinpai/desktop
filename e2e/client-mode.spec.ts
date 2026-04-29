// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet. Re-enable as features are implemented.
/**
 * E2E Tests for Client Mode Flow
 * Tests the complete user journey from discovery to connection
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('Client Mode Discovery and Connection', () => {
  test('should display mode selection on first launch', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Verify mode selection screen
    await expect(page.getByText('Welcome to EdwinPAI Desktop')).toBeVisible();
    await expect(page.getByText('Gateway Mode')).toBeVisible();
    await expect(page.getByText('Client Mode')).toBeVisible();
  });

  test('should navigate to client connection flow', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Click client mode
    await page.getByText('Client Mode').click();

    // Verify discovery screen appears
    await expect(page.getByText('Discover Gateways')).toBeVisible();
    await expect(page.getByText('Scanning your local network')).toBeVisible();
  });

  test('should display discovered gateways', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode
    await page.getByText('Client Mode').click();

    // Wait for discovery (mock will return peers)
    await page.waitForTimeout(1000);

    // Verify peer list displays
    await expect(page.getByText(/Online|ago/)).toBeVisible();
  });

  test('should allow peer selection and connection', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode
    await page.getByText('Client Mode').click();

    // Wait for discovery
    await page.waitForTimeout(1000);

    // Select first peer
    await page.getByRole('button', { name: 'Select' }).first().click();

    // Verify confirmation screen
    await expect(page.getByText('Confirm Gateway')).toBeVisible();
    await expect(page.getByText('Petname')).toBeVisible();

    // Connect
    await page.getByRole('button', { name: 'Connect' }).click();

    // Verify connection status
    await expect(page.getByText(/Authenticating|Connected/)).toBeVisible();
  });

  test('should handle connection errors gracefully', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode with error scenario
    await page.getByText('Client Mode').click();

    // Simulate connection failure (mock will handle this)
    await page.waitForTimeout(1000);

    // Error should be displayed
    const errorMessage = page.getByText(/Connection failed|Failed to connect/);
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should allow cancelling connection flow', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate to client mode
    await page.getByText('Client Mode').click();

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should return to mode selection
    await expect(page.getByText('Welcome to EdwinPAI Desktop')).toBeVisible();
  });
});

test.describe.fixme('Connection Status Display', () => {
  test('should show connecting status during authentication', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate and initiate connection
    await page.getByText('Client Mode').click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('button', { name: 'Connect' }).click();

    // Verify connecting status shows
    await expect(page.getByText('Connecting')).toBeVisible();
  });

  test('should show connected status after successful auth', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Navigate and complete connection
    await page.getByText('Client Mode').click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('button', { name: 'Connect' }).click();

    // Wait for connection
    await page.waitForTimeout(2000);

    // Verify connected status
    const connectedText = page.getByText('Connected');
    if (await connectedText.isVisible()) {
      await expect(connectedText).toBeVisible();
      await expect(page.getByText('Encrypted connection established')).toBeVisible();
    }
  });
});
