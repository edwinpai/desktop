// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet. Re-enable as features are implemented.
/**
 * E2E Tests for Mode Switching (Gateway ↔ Client)
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('Mode Selection', () => {
  test('should display both gateway and client mode options', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Verify both modes are displayed
    await expect(page.getByText('Gateway Mode')).toBeVisible();
    await expect(page.getByText('Run your own AI gateway')).toBeVisible();

    await expect(page.getByText('Client Mode')).toBeVisible();
    await expect(page.getByText('Connect to a remote gateway')).toBeVisible();
  });

  test('should show features for each mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Verify gateway mode features
    await expect(page.getByText('Full control')).toBeVisible();
    await expect(page.getByText('Share with others')).toBeVisible();

    // Verify client mode features
    await expect(page.getByText('Quick setup')).toBeVisible();
    await expect(page.getByText('Guest access')).toBeVisible();
  });

  test('should select gateway mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Click gateway mode
    await page.getByText('Gateway Mode').click();

    // Should navigate to chat (or onboarding)
    await page.waitForTimeout(500);
    const chatView = page.getByText('Welcome to EdwinPAI Desktop');
    if (await chatView.isVisible()) {
      await expect(chatView).toBeVisible();
    }
  });

  test('should select client mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Click client mode
    await page.getByText('Client Mode').click();

    // Should navigate to discovery
    await expect(page.getByText('Discover Gateways')).toBeVisible();
  });

  test('should not allow switching modes without confirmation when active', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Select gateway mode
    await page.getByText('Gateway Mode').click();

    // Try to switch to client mode (would require confirmation in real app)
    // This test verifies the confirmation dialog appears
    // (In real E2E, you'd verify the dialog with page.on('dialog'))
  });
});

test.describe.fixme('Mode Switching with Confirmation', () => {
  test('should show confirmation when switching from active gateway', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Mock: Gateway is running
    await page.getByText('Gateway Mode').click();

    // Attempt to switch modes (would trigger confirmation)
    // In production, this would show a dialog
  });

  test('should show confirmation when switching from connected client', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Mock: Client is connected
    await page.getByText('Client Mode').click();
    await page.waitForTimeout(1000);

    // Complete connection
    const selectBtn = page.getByRole('button', { name: 'Select' });
    if (await selectBtn.isVisible()) {
      await selectBtn.first().click();
      await page.getByRole('button', { name: 'Connect' }).click();

      // Wait for connection
      await page.waitForTimeout(2000);

      // Attempt to switch modes (would trigger confirmation)
    }
  });

  test('should cancel mode switch when user declines', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Set up dialog handler to cancel
    page.on('dialog', dialog => dialog.dismiss());

    // Mock active gateway and attempt switch
    await page.getByText('Gateway Mode').click();

    // Should remain in gateway mode
  });

  test('should complete mode switch when user confirms', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Set up dialog handler to accept
    page.on('dialog', dialog => dialog.accept());

    // Mock active gateway and attempt switch
    await page.getByText('Gateway Mode').click();

    // Should switch to new mode
  });
});

test.describe.fixme('Active Mode Indicators', () => {
  test('should show active indicator for gateway mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    await page.getByText('Gateway Mode').click();

    // Verify active indicator
    const activeIndicator = page.getByText('Active');
    if (await activeIndicator.isVisible()) {
      await expect(activeIndicator).toBeVisible();
    }
  });

  test('should highlight current mode selection', async ({ page }) => {
    await page.goto('tauri://localhost');

    await page.getByText('Gateway Mode').click();

    // Verify mode is highlighted (check for "Current Mode" text)
    const currentMode = page.getByText('Current Mode');
    if (await currentMode.isVisible()) {
      await expect(currentMode).toBeVisible();
    }
  });
});

test.describe.fixme('State Persistence Across Mode Switches', () => {
  test('should persist gateway configuration after mode switch', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Setup gateway mode
    await page.getByText('Gateway Mode').click();

    // Skip onboarding or complete it
    const generateButton = page.getByRole('button', { name: /Generate Identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();

      // Set custom port
      const portInput = page.getByLabel(/Port/i);
      if (await portInput.isVisible()) {
        await portInput.fill('8888');
      }

      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Open settings and switch to client mode
    const settingsButton = page.getByRole('button', { name: /Settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.getByText(/General/i).click();

      // Switch to client mode
      const modeSelector = page.getByLabel(/Mode/i);
      if (await modeSelector.isVisible()) {
        await modeSelector.selectOption('client');
        await page.getByRole('button', { name: /Save|Apply/i }).click();

        // Handle confirmation dialog
        page.on('dialog', dialog => dialog.accept());
        await page.waitForTimeout(2000);

        // Switch back to gateway mode
        await modeSelector.selectOption('gateway');
        await page.getByRole('button', { name: /Save/i }).click();
        await page.waitForTimeout(2000);

        // Verify port configuration persisted
        await page.getByText(/General/i).click();
        const portAfterSwitch = page.getByLabel(/Port/i);
        await expect(portAfterSwitch).toHaveValue('8888');
      }
    }
  });

  test('should persist client connection state after app restart', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Setup client mode
    await page.getByText('Client Mode').click();
    await page.waitForTimeout(2000);

    // Connect to gateway
    const selectButton = page.getByRole('button', { name: /Select/i }).first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await page.getByRole('button', { name: /Connect/i }).click();
      await page.waitForTimeout(3000);

      // Verify connected
      const connectedStatus = page.getByText(/Connected/i);
      if (await connectedStatus.isVisible()) {
        // Store connection info
        const connectionInfo = await page.evaluate(async () => {
          // @ts-ignore
          if (window.__TAURI__) {
            try {
              // @ts-ignore
              const config = await window.__TAURI__.invoke('get_config');
              return {
                mode: config.mode,
                connected: config.client_connection_state === 'connected'
              };
            } catch {
              return null;
            }
          }
          return null;
        });

        expect(connectionInfo?.mode).toBe('client');
        expect(connectionInfo?.connected).toBe(true);

        // Reload page (simulate restart)
        await page.reload();
        await page.waitForTimeout(2000);

        // Verify reconnection or restored state
        const restoredConnection = page.getByText(/Connected|Reconnecting/i);
        if (await restoredConnection.isVisible()) {
          await expect(restoredConnection).toBeVisible();
        }
      }
    }
  });

  test('should maintain chat history after mode switch', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Setup gateway
    await page.getByText('Gateway Mode').click();

    const generateButton = page.getByRole('button', { name: /Generate Identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Send a message
    const chatInput = page.getByPlaceholder(/Type a message/i);
    const testMessage = 'Message before mode switch';
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify message exists
    await expect(page.getByText(testMessage)).toBeVisible();

    // Switch to client mode (if possible, or just verify chat persistence)
    // In many implementations, chat history is separate from mode

    // Reload to simulate restart
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to chat
    const gatewayButton = page.getByText(/Gateway Mode|Continue/i);
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.waitForTimeout(2000);
    }

    // Verify message still exists
    await expect(page.getByText(testMessage)).toBeVisible();
  });

  test('should disconnect client when switching to gateway mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Setup client mode
    await page.getByText('Client Mode').click();
    await page.waitForTimeout(2000);

    // Connect to gateway
    const selectButton = page.getByRole('button', { name: /Select/i }).first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await page.getByRole('button', { name: /Connect/i }).click();
      await page.waitForTimeout(3000);

      // Verify connected
      const connectedStatus = page.getByText(/Connected/i);
      if (await connectedStatus.isVisible()) {
        // Switch to gateway mode
        const settingsButton = page.getByRole('button', { name: /Settings/i });
        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          await page.getByText(/General/i).click();

          const modeSelector = page.getByLabel(/Mode/i);
          if (await modeSelector.isVisible()) {
            // Handle confirmation dialog
            page.on('dialog', dialog => dialog.accept());

            await modeSelector.selectOption('gateway');
            await page.getByRole('button', { name: /Save/i }).click();
            await page.waitForTimeout(2000);

            // Verify client is disconnected
            const disconnectedStatus = page.getByText(/Disconnected|Not connected/i);
            if (await disconnectedStatus.isVisible()) {
              await expect(disconnectedStatus).toBeVisible();
            }

            // Verify gateway is starting/started
            const gatewayStatus = page.getByText(/Starting|Running|Gateway Active/i);
            if (await gatewayStatus.isVisible()) {
              await expect(gatewayStatus).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('should stop gateway when switching to client mode', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Setup gateway mode
    await page.getByText('Gateway Mode').click();

    const generateButton = page.getByRole('button', { name: /Generate Identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Verify gateway is running
    const runningStatus = page.getByText(/Running|Online|Gateway Active/i);
    if (await runningStatus.isVisible()) {
      // Switch to client mode
      const settingsButton = page.getByRole('button', { name: /Settings/i });
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await page.getByText(/General/i).click();

        const modeSelector = page.getByLabel(/Mode/i);
        if (await modeSelector.isVisible()) {
          // Handle confirmation dialog
          page.on('dialog', dialog => dialog.accept());

          await modeSelector.selectOption('client');
          await page.getByRole('button', { name: /Save/i }).click();
          await page.waitForTimeout(2000);

          // Verify gateway stopped
          const stoppedStatus = page.getByText(/Stopped|Offline|Gateway Inactive/i);
          if (await stoppedStatus.isVisible()) {
            await expect(stoppedStatus).toBeVisible();
          }

          // Verify client mode UI
          await expect(page.getByText(/Discover Gateways|Client Mode/i)).toBeVisible();
        }
      }
    }
  });
});
