/**
 * Main interface tests — verifies sidebar navigation, chat, and key UI elements.
 *
 * These tests assume the app has already connected to a gateway (config exists)
 * and lands on the main chat interface.
 */

describe('Sidebar Navigation', () => {
  it('should show all navigation items', async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });

    // Wait for loading screen to finish
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000, timeoutMsg: 'App did not finish loading within 15s' });

    const text = await body.getText();
    expect(text).toContain('Chat');
    expect(text).toContain('Channels');
    expect(text).toContain('Access Control');
    expect(text).toContain('Settings');
  });

  it('should show Gateway Mode indicator', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Gateway Mode');
  });

  it('should show gateway status', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Gateway');
  });

  it('should navigate to Channels section', async () => {
    const channelsLink = await $('button=Channels');
    if (await channelsLink.isExisting()) {
      await channelsLink.click();
    } else {
      // Try sidebar nav item
      const nav = await $('nav');
      const links = await nav.$$('a, button');
      for (const link of links) {
        const text = await link.getText();
        if (text.includes('Channels')) {
          await link.click();
          break;
        }
      }
    }
    await browser.pause(500);

    const body = await $('body');
    const text = await body.getText();
    // Should show channel-related content
    const hasChannels = text.includes('Channel') || text.includes('Telegram') ||
                        text.includes('Discord') || text.includes('configured');
    expect(hasChannels).toBe(true);
  });

  it('should navigate to Settings section', async () => {
    // Find and click Settings in the nav
    const body = await $('body');
    const allText = await body.getText();

    // Use CSS to find nav items
    const navItems = await $$('nav a, nav button, aside a, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text.includes('Settings')) {
        await item.click();
        break;
      }
    }
    await browser.pause(500);

    const newText = await body.getText();
    const hasSettings = newText.includes('Settings') || newText.includes('Gateway URL') ||
                        newText.includes('Provider') || newText.includes('Model');
    expect(hasSettings).toBe(true);
  });

  it('should navigate to Access Control section', async () => {
    const navItems = await $$('nav a, nav button, aside a, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text.includes('Access Control')) {
        await item.click();
        break;
      }
    }
    await browser.pause(500);

    const body = await $('body');
    const text = await body.getText();
    const hasAccess = text.includes('Access') || text.includes('Invitation') ||
                      text.includes('Users') || text.includes('Control');
    expect(hasAccess).toBe(true);
  });

  it('should navigate back to Chat', async () => {
    const navItems = await $$('nav a, nav button, aside a, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Chat') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Press Enter to send');
  });
});

describe('Chat Interface', () => {
  it('should show the AI assistant welcome message', async () => {
    // Navigate to chat first
    const navItems = await $$('nav a, nav button, aside a, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Chat') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Your personal AI assistant');
  });

  it('should show suggestion chips', async () => {
    const body = await $('body');
    const text = await body.getText();
    const hasSuggestions = text.includes('What can you do') ||
                           text.includes('Search the web') ||
                           text.includes('Remember this');
    expect(hasSuggestions).toBe(true);
  });

  it('should have a message input', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Press Enter to send');
  });
});
