/**
 * Access Control page — tests BSV identity, invitations, and user management.
 */

describe('Access Control Page', () => {
  before(async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000 });

    // Navigate to Access Control
    const navItems = await $$('nav button, aside button');
    for (const item of navItems) {
      const text = await item.getText();
      if (text === 'Access Control') {
        await item.click();
        break;
      }
    }
    await browser.pause(500);
  });

  describe('BSV Identity', () => {
    it('should show blockchain identity section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Blockchain Identity');
      expect(text).toContain('Active');
    });

    it('should show identity details', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Identity');
      expect(text).toContain('Key Type');
      expect(text).toContain('BSV');
      expect(text).toContain('Public Key');
    });

    it('should show key source', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Key Source');
      expect(text).toContain('OS Keychain');
    });

    it('should have Self-Check button', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Self-Check');
    });
  });

  describe('Invitations', () => {
    it('should show Create Invitation section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Create Invitation');
      expect(text).toContain('Permission Level');
      expect(text).toContain('Expires In');
    });

    it('should show Active Invitations section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Active Invitations');
    });
  });

  describe('Authorized Users', () => {
    it('should show Authorized Users section', async () => {
      const body = await $('body');
      const text = await body.getText();
      expect(text).toContain('Authorized Users');
    });
  });
});
