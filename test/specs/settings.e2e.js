/**
 * Settings page — tests all settings sections and form interactions.
 * Exercises the real Tauri app.
 */

describe('Settings Page', () => {
  before(async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000 });

    // Navigate to Settings
    const navItems = await $$('nav button, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Settings') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);
  });

  describe('Settings Sections', () => {
    it('should show Appearance section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Appearance');
      expect(text).toContain('Theme');
    });

    it('should show Behavior section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Behavior');
      expect(text).toContain('Notifications');
      expect(text).toContain('Auto-scroll');
    });

    it('should show Gateway Connection section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Gateway Connection');
      expect(text).toContain('Gateway URL');
      expect(text).toContain('Auth Token');
      expect(text).toContain('Test Connection');
    });

    it('should show Gateway Configuration section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Gateway Configuration');
      expect(text).toContain('Port');
      expect(text).toContain('Bind Mode');
    });

    it('should show gateway control buttons', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Start');
      expect(text).toContain('Stop');
      expect(text).toContain('Restart');
    });

    it('should show Agent Configuration section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Agent Configuration');
      expect(text).toContain('Primary Model');
      expect(text).toContain('Fallback Models');
      expect(text).toContain('Memory Search');
      expect(text).toContain('Embedding Provider');
    });

    it('should show Web Tools section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Web Tools');
      expect(text).toContain('Web Search');
      expect(text).toContain('Brave Search API Key');
    });

    it('should show AI Providers section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('AI Providers');
      expect(text).toContain('anthropic');
    });

    it('should show App Lock section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('App Lock');
      expect(text).toContain('Set Up PIN');
    });

    it('should show Application Mode section with Gateway/Client toggle', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Application Mode');
      expect(text).toContain('Gateway Mode');
      expect(text).toContain('Client Mode');
    });

    it('should show Save Changes button', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Save Changes');
      expect(text).toContain('Reset to Defaults');
    });
  });
});
