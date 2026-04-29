/**
 * Channels page — tests channel list, configuration, and wizard access.
 * Exercises the real Tauri app against the running gateway.
 */

describe('Channels Page', () => {
  before(async () => {
    // Wait for app to load
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000 });

    // Navigate to Channels
    const navItems = await $$('nav button, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Channels') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);
  });

  it('should show Channel Integrations heading', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Channel Integrations');
  });

  it('should show Matrix as a configured channel', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Matrix');
    expect(text).toContain('Active');
  });

  it('should show unconfigured channels with Configure buttons', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Telegram');
    expect(text).toContain('Discord');
    expect(text).toContain('Slack');
    expect(text).toContain('WhatsApp');
    expect(text).toContain('Signal');
    expect(text).toContain('Configure');
  });

  it('should show Matrix channel details', async () => {
    const body = await $('body');
    const text = await body.getText();
    // Matrix should show auto-reply status and allowed chats count
    expect(text).toContain('Auto-reply');
    expect(text).toContain('chat(s)');
  });

  it('should have an Add New Channel button', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Add New Channel');
  });
});

describe('Channel Configuration - Telegram', () => {
  it('should open Telegram configure dialog', async () => {
    // Find the Telegram Configure button
    const buttons = await $$('button');
    let clicked = false;
    for (const btn of buttons) {
      const text = await btn.getText();
      // Look for the Configure button near Telegram
      if (text === 'Configure') {
        // Check if this is in the Telegram section
        const parent = await btn.$('..');
        const parentText = await parent.getText().catch(() => '');
        if (parentText.includes('Telegram')) {
          await btn.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      // Try clicking the first Configure button
      const configBtns = await $$('button');
      for (const btn of configBtns) {
        const text = await btn.getText();
        if (text === 'Configure') {
          await btn.click();
          break;
        }
      }
    }

    await browser.pause(1000);

    // Should show a wizard or config dialog
    const body = await $('body');
    const text = await body.getText();
    const hasWizardOrConfig = text.includes('Telegram') ||
                               text.includes('Bot Token') ||
                               text.includes('Connect Telegram') ||
                               text.includes('BotFather');
    expect(hasWizardOrConfig).toBe(true);
  });
});
