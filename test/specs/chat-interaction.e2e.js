/**
 * Chat interaction tests — exercises the chat input and message flow.
 */

describe('Chat Interaction', () => {
  before(async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000 });

    // Navigate to Chat
    const navItems = await $$('nav button, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Chat') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);
  });

  it('should show welcome message', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Your personal AI assistant');
  });

  it('should have suggestion chips', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('What can you do');
    expect(text).toContain('Search the web');
    expect(text).toContain('Remember this');
  });

  it('should show input instructions', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Press Enter to send');
    expect(text).toContain('Shift+Enter for new line');
  });

  it('should have a text input for messages', async () => {
    // Find textarea or input for chat
    const textarea = await $('textarea');
    const exists = await textarea.isExisting();
    if (exists) {
      expect(await textarea.isDisplayed()).toBe(true);
    } else {
      // Might be an input or contenteditable
      const input = await $('input[type="text"]');
      expect(await input.isExisting()).toBe(true);
    }
  });

  it('should accept text input', async () => {
    const textarea = await $('textarea');
    if (await textarea.isExisting()) {
      await textarea.setValue('Hello Edwin');
      const value = await textarea.getValue();
      expect(value).toContain('Hello Edwin');
      // Clear it
      await textarea.clearValue();
    }
  });

  it('should show gateway connection status', async () => {
    const body = await $('body');
    const text = await body.getText();
    // Should show either "connected" or "not connected" status
    const hasStatus = text.includes('Gateway Running') ||
                      text.includes('Not connected') ||
                      text.includes('Connected');
    expect(hasStatus).toBe(true);
  });
});
