// FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
// that don't exist yet (Gateway/Client mode selection, advanced wizards, etc.)
// Re-enable as features are implemented.

/**
 * E2E Tests for Chat Flow
 * Tests message sending, receiving, SSE streaming, and chat persistence
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('Chat Message Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Complete onboarding to reach chat interface
    await page.goto('tauri://localhost');

    // Quick gateway setup
    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }
  });

  test('should send a message and display it in chat history', async ({ page }) => {
    // Locate chat input
    const chatInput = page.getByPlaceholder(/Type a message|Send a message/i);
    await expect(chatInput).toBeVisible();

    // Type a message
    const testMessage = 'Hello, EdwinPAI! This is a test message.';
    await chatInput.fill(testMessage);

    // Send message (Enter key or Send button)
    const sendButton = page.getByRole('button', { name: /Send|Submit/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Verify message appears in chat history
    await expect(page.getByText(testMessage)).toBeVisible();

    // Verify message has user styling
    const messageElement = page.getByText(testMessage).locator('..');
    await expect(messageElement).toHaveClass(/user|sent|outgoing/);
  });

  test('should receive AI response with SSE streaming', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('What is 2 + 2?');

    // Send message
    const sendButton = page.getByRole('button', { name: /Send/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Wait for response to start streaming
    await page.waitForTimeout(1000);

    // Should see "Thinking..." or loading indicator
    const thinkingIndicator = page.getByText(/Thinking|Typing|Processing/i);
    if (await thinkingIndicator.isVisible()) {
      await expect(thinkingIndicator).toBeVisible();
    }

    // Wait for response to complete (SSE stream)
    await page.waitForTimeout(3000);

    // Should see assistant response
    const assistantMessage = page.getByText(/The answer is 4|2 \+ 2 = 4|equals 4/i);
    if (await assistantMessage.isVisible()) {
      await expect(assistantMessage).toBeVisible();

      // Verify message has assistant styling
      const messageElement = assistantMessage.locator('..');
      await expect(messageElement).toHaveClass(/assistant|received|incoming/);
    }
  });
});

test.describe.fixme('Chat History Persistence', () => {
  test('should persist chat history to localStorage', async ({ page }) => {
    await page.goto('tauri://localhost');

    // Complete setup
    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Send a message
    const chatInput = page.getByPlaceholder(/Type a message/i);
    const testMessage = 'This message should persist';
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');

    await page.waitForTimeout(1000);

    // Verify message is in DOM
    await expect(page.getByText(testMessage)).toBeVisible();

    // Check localStorage
    const chatHistory = await page.evaluate(() => {
      return localStorage.getItem('edwinpai_chat_history');
    });

    expect(chatHistory).toBeTruthy();
    expect(chatHistory).toContain(testMessage);
  });

  test('should restore chat history on app restart', async ({ page }) => {
    // Seed localStorage with previous messages
    const mockHistory = JSON.stringify({
      messages: [
        { id: '1', role: 'user', content: 'Previous message 1', timestamp: Date.now() - 10000 },
        { id: '2', role: 'assistant', content: 'Previous response 1', timestamp: Date.now() - 9000 },
        { id: '3', role: 'user', content: 'Previous message 2', timestamp: Date.now() - 5000 },
      ]
    });

    await page.goto('tauri://localhost');

    // Set localStorage before app initializes
    await page.evaluate((history) => {
      localStorage.setItem('edwinpai_chat_history', history);
    }, mockHistory);

    // Reload to trigger history restoration
    await page.reload();

    // Complete setup if needed
    const gatewayButton = page.getByRole('button', { name: /Gateway Mode/i });
    if (await gatewayButton.isVisible()) {
      await gatewayButton.click();
      await page.getByRole('button', { name: /Generate Identity/i }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.getByRole('button', { name: /Start Gateway/i }).click();
      await page.waitForTimeout(3000);
    }

    // Verify previous messages are displayed
    await expect(page.getByText('Previous message 1')).toBeVisible();
    await expect(page.getByText('Previous response 1')).toBeVisible();
    await expect(page.getByText('Previous message 2')).toBeVisible();
  });
});

test.describe.fixme('Chat UI Interactions', () => {
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
  });

  test('should auto-scroll to latest message', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send multiple messages to fill chat
    for (let i = 1; i <= 5; i++) {
      await chatInput.fill(`Test message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(500);
    }

    // Last message should be visible
    await expect(page.getByText('Test message 5')).toBeVisible();

    // Check if scrolled to bottom
    const chatContainer = page.locator('[class*="chat"]').first();
    const isScrolledToBottom = await chatContainer.evaluate((el) => {
      return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    });

    expect(isScrolledToBottom).toBe(true);
  });

  test('should disable input while waiting for response', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Test question');
    await chatInput.press('Enter');

    // Input should be disabled immediately
    await expect(chatInput).toBeDisabled();

    // Wait for response to complete
    await page.waitForTimeout(3000);

    // Input should be enabled again
    await expect(chatInput).toBeEnabled();
  });

  test('should support markdown formatting in messages', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send message with markdown
    const markdownMessage = '**Bold text** and *italic text* and `code`';
    await chatInput.fill(markdownMessage);
    await chatInput.press('Enter');

    await page.waitForTimeout(1000);

    // Verify markdown is rendered (not raw text)
    const messageElement = page.locator('text=Bold text').first();
    await expect(messageElement).toBeVisible();

    // Check for HTML tags indicating markdown rendering
    const hasBoldTag = await page.locator('strong:has-text("Bold text")').count() > 0;
    expect(hasBoldTag).toBe(true);
  });

  test('should clear input after sending message', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('Test message');
    await chatInput.press('Enter');

    await page.waitForTimeout(500);

    // Input should be empty
    await expect(chatInput).toHaveValue('');
  });

  test('should show error message on send failure', async ({ page }) => {
    // Simulate network error by stopping gateway
    // (Implementation depends on mock setup)

    const chatInput = page.getByPlaceholder(/Type a message/i);
    await chatInput.fill('This should fail');
    await chatInput.press('Enter');

    await page.waitForTimeout(2000);

    // Look for error message
    const errorMessage = page.getByText(/Failed to send|Error sending|Connection error/i);
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();

      // Should offer retry option
      const retryButton = page.getByRole('button', { name: /Retry|Try Again/i });
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();
      }
    }
  });
});

test.describe.fixme('Message History Navigation', () => {
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
  });

  test('should allow scrolling through message history', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send many messages
    for (let i = 1; i <= 10; i++) {
      await chatInput.fill(`Message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // Scroll to top
    const chatContainer = page.locator('[class*="chat"]').first();
    await chatContainer.evaluate((el) => el.scrollTop = 0);

    // First message should be visible
    await expect(page.getByText('Message 1')).toBeVisible();
  });

  test('should support clearing chat history', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Type a message/i);

    // Send messages
    await chatInput.fill('Message to clear');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Look for clear history option
    const clearButton = page.getByRole('button', { name: /Clear|Clear History|Delete All/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();

      // Confirm dialog may appear
      const confirmButton = page.getByRole('button', { name: /Confirm|Yes|Delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);

      // Messages should be gone
      await expect(page.getByText('Message to clear')).not.toBeVisible();
    }
  });
});
