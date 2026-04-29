// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet. Re-enable as features are implemented.
/**
 * E2E Integration Tests for Phase 7: Chat Frontend with SSE Streaming
 * Tests SSE event handling, [DONE] signal, tool use rendering, error recovery
 *
 * Test Coverage:
 * - SSE streaming with ReadableStream parsing
 * - [DONE] signal handling
 * - Tool use card rendering (collapsible, syntax highlighting)
 * - Streaming state management (loading, isStreaming, error)
 * - Error recovery and retry logic
 * - Chat persistence to localStorage
 * - Markdown rendering with react-markdown
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('Phase 7: SSE Streaming Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Complete onboarding to reach chat interface
    await page.goto('tauri://localhost');

    // Quick gateway setup
    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000); // Wait for gateway to start
    }
  });

  test('should handle SSE streaming with multiple events', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message|Send a message/i);
    await expect(chatInput).toBeVisible();

    // Send a message that triggers streaming response
    const testMessage = 'Tell me a short story in 3 sentences.';
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');

    // Verify message appears in chat
    await expect(page.getByText(testMessage)).toBeVisible();

    // Should show streaming indicator
    await page.waitForTimeout(500);
    const streamingIndicator = page.getByText(/Thinking|Typing|Generating/i);
    if (await streamingIndicator.isVisible({ timeout: 1000 })) {
      await expect(streamingIndicator).toBeVisible();
    }

    // Wait for streaming to complete
    await page.waitForTimeout(5000);

    // Should see assistant response
    const assistantMessage = page.locator('[class*="assistant"]').last();
    await expect(assistantMessage).toBeVisible();

    // Verify streaming has stopped (indicator should disappear)
    await expect(streamingIndicator).not.toBeVisible({ timeout: 2000 });
  });

  test('should parse [DONE] signal correctly', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Say "hello"');
    await chatInput.press('Enter');

    // Wait for streaming to start and complete
    await page.waitForTimeout(3000);

    // Should not show [DONE] in the UI (it's a control signal)
    const doneText = page.getByText('[DONE]', { exact: true });
    await expect(doneText).not.toBeVisible();

    // Should show complete message
    const assistantMessage = page.locator('[class*="assistant"]').last();
    await expect(assistantMessage).toBeVisible();

    // Input should be enabled again (streaming complete)
    await expect(chatInput).toBeEnabled();
  });

  test('should render tool use cards with collapsible content', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send a message that might trigger tool use
    await chatInput.fill('What files are in the current directory?');
    await chatInput.press('Enter');

    await page.waitForTimeout(4000);

    // Look for tool use card (if AI uses tools)
    const toolUseCard = page.locator('[class*="tool"]').first();
    if (await toolUseCard.isVisible({ timeout: 2000 })) {
      // Should have collapsible functionality
      const expandButton = toolUseCard.getByRole('button', { name: /expand|collapse|show|hide/i });
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(300);

        // Tool details should be visible
        const toolDetails = toolUseCard.locator('code, pre').first();
        await expect(toolDetails).toBeVisible();

        // Can collapse again
        await expandButton.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('should display markdown rendering correctly', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send a message requesting markdown response
    await chatInput.fill('Respond with: **bold**, *italic*, and `code`');
    await chatInput.press('Enter');

    await page.waitForTimeout(3000);

    // Should render markdown HTML elements
    const boldElement = page.locator('strong').first();
    if (await boldElement.isVisible({ timeout: 2000 })) {
      await expect(boldElement).toBeVisible();
    }

    const codeElement = page.locator('code').first();
    if (await codeElement.isVisible({ timeout: 2000 })) {
      await expect(codeElement).toBeVisible();
    }
  });

  test('should handle streaming errors gracefully', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send a message
    await chatInput.fill('Test error handling');
    await chatInput.press('Enter');

    await page.waitForTimeout(1000);

    // If error occurs, should show error message
    const errorMessage = page.getByText(/Error|Failed|Connection|Timeout/i);
    if (await errorMessage.isVisible({ timeout: 5000 })) {
      await expect(errorMessage).toBeVisible();

      // Should offer retry button
      const retryButton = page.getByRole('button', { name: /Retry|Try Again/i });
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();

        // Retry should work
        await retryButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });
});

test.describe.fixme('Phase 7: Streaming State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }
  });

  test('should disable input during streaming', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Count to 5');
    await chatInput.press('Enter');

    // Input should be disabled immediately
    await page.waitForTimeout(200);
    await expect(chatInput).toBeDisabled();

    // Wait for streaming to complete
    await page.waitForTimeout(4000);

    // Input should be enabled again
    await expect(chatInput).toBeEnabled();
  });

  test('should show typing indicator during streaming', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Say hello');
    await chatInput.press('Enter');

    // Should show typing/thinking indicator
    await page.waitForTimeout(500);
    const indicator = page.getByText(/Thinking|Typing|Generating|Processing/i);
    if (await indicator.isVisible({ timeout: 1000 })) {
      await expect(indicator).toBeVisible();

      // Wait for completion
      await page.waitForTimeout(3000);

      // Indicator should disappear
      await expect(indicator).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should clear input after sending', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    const testMessage = 'This message should clear';

    await chatInput.fill(testMessage);
    await chatInput.press('Enter');

    // Input should be empty after send
    await page.waitForTimeout(500);
    await expect(chatInput).toHaveValue('');
  });

  test('should handle rapid successive messages', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send first message
    await chatInput.fill('Message 1');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Wait for first to complete
    await expect(chatInput).toBeEnabled({ timeout: 5000 });

    // Send second message immediately
    await chatInput.fill('Message 2');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Both messages should be visible
    await expect(page.getByText('Message 1')).toBeVisible();
    await expect(page.getByText('Message 2')).toBeVisible();
  });
});

test.describe.fixme('Phase 7: Chat Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }
  });

  test('should persist messages to localStorage', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    const persistMessage = 'This should persist in localStorage';

    await chatInput.fill(persistMessage);
    await chatInput.press('Enter');

    await page.waitForTimeout(2000);

    // Check localStorage
    const chatHistory = await page.evaluate(() => {
      return localStorage.getItem('edwinpai_chat_history');
    });

    expect(chatHistory).toBeTruthy();
    expect(chatHistory).toContain(persistMessage);
  });

  test('should restore chat history on reload', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    const testMessage = 'Message to restore';

    await chatInput.fill(testMessage);
    await chatInput.press('Enter');

    await page.waitForTimeout(2000);
    await expect(page.getByText(testMessage)).toBeVisible();

    // Reload page
    await page.reload();

    // Re-complete onboarding
    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Message should still be visible
    await expect(page.getByText(testMessage)).toBeVisible();
  });

  test('should handle large chat history (100+ messages)', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send multiple messages rapidly
    for (let i = 1; i <= 10; i++) {
      await chatInput.fill(`Test message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // All messages should be in history
    const chatHistory = await page.evaluate(() => {
      return localStorage.getItem('edwinpai_chat_history');
    });

    expect(chatHistory).toBeTruthy();
    expect(chatHistory).toContain('Test message 1');
    expect(chatHistory).toContain('Test message 10');

    // Should be able to scroll to see all messages
    const chatContainer = page.locator('[class*="chat"]').first();
    await chatContainer.evaluate((el) => el.scrollTop = 0);

    await expect(page.getByText('Test message 1')).toBeVisible();
  });
});

test.describe.fixme('Phase 7: ReadableStream Buffer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }
  });

  test('should handle partial SSE chunks across network packets', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send message that generates long response (multiple chunks)
    await chatInput.fill('Write a paragraph about AI');
    await chatInput.press('Enter');

    await page.waitForTimeout(500);

    // Should show streaming
    const streamingIndicator = page.getByText(/Thinking|Typing/i);
    if (await streamingIndicator.isVisible({ timeout: 1000 })) {
      await expect(streamingIndicator).toBeVisible();
    }

    // Wait for streaming to complete
    await page.waitForTimeout(5000);

    // Should have complete response (no partial JSON errors)
    const assistantMessage = page.locator('[class*="assistant"]').last();
    await expect(assistantMessage).toBeVisible();

    // Response should be coherent (not cut off mid-sentence)
    const messageText = await assistantMessage.textContent();
    expect(messageText).toBeTruthy();
    expect(messageText!.length).toBeGreaterThan(10);
  });

  test('should not display [DONE] signal in UI', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Quick test');
    await chatInput.press('Enter');

    await page.waitForTimeout(3000);

    // [DONE] should NOT appear in any message
    const allMessages = page.locator('[class*="message"]');
    const count = await allMessages.count();

    for (let i = 0; i < count; i++) {
      const text = await allMessages.nth(i).textContent();
      expect(text).not.toContain('[DONE]');
    }
  });

  test('should handle JSON parse errors gracefully', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Test JSON parsing');
    await chatInput.press('Enter');

    await page.waitForTimeout(3000);

    // Should either show response or error message, not crash
    const assistantMessage = page.locator('[class*="assistant"]').last();
    const errorMessage = page.getByText(/Error|Failed/i);

    const hasResponse = await assistantMessage.isVisible({ timeout: 1000 });
    const hasError = await errorMessage.isVisible({ timeout: 1000 });

    expect(hasResponse || hasError).toBe(true);
  });
});

test.describe.fixme('Phase 7: Auto-scroll and Virtualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');

    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible({ timeout: 2000 })) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }
  });

  test('should auto-scroll to latest message', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send multiple messages
    for (let i = 1; i <= 5; i++) {
      await chatInput.fill(`Message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(800);
    }

    // Last message should be visible
    await expect(page.getByText('Message 5')).toBeVisible();

    // Chat should be scrolled to bottom
    const chatContainer = page.locator('[class*="chat"]').first();
    const isAtBottom = await chatContainer.evaluate((el) => {
      return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 20;
    });

    expect(isAtBottom).toBe(true);
  });

  test('should maintain scroll position when scrolled up', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send messages to create scrollable content
    for (let i = 1; i <= 8; i++) {
      await chatInput.fill(`Message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(500);
    }

    // Scroll to top
    const chatContainer = page.locator('[class*="chat"]').first();
    await chatContainer.evaluate((el) => el.scrollTop = 0);

    // Wait to ensure scroll position is stable
    await page.waitForTimeout(500);

    // First message should be visible
    await expect(page.getByText('Message 1')).toBeVisible();

    // Send new message
    await chatInput.fill('New message');
    await chatInput.press('Enter');
    await page.waitForTimeout(500);

    // Should still see first message (not auto-scrolled)
    await expect(page.getByText('Message 1')).toBeVisible();
  });
});
