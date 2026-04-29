/**
 * Smoke tests — verifies the Tauri app launches and renders the main interface.
 *
 * NOTE: The app auto-connects to the local gateway on launch when config exists,
 * so we land on the main chat interface, not the onboarding wizard.
 * If no config exists, we'd see onboarding first.
 */

describe('Edwin Desktop - Smoke', () => {
  it('should load the app and render content', async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    const text = await body.getText();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should have the correct page title', async () => {
    const title = await browser.getTitle();
    expect(title).toBe('Edwin Desktop');
  });

  it('should show Edwin Desktop in the sidebar', async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
    const text = await body.getText();
    expect(text).toContain('Edwin Desktop');
  });

  it('should show version info', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toMatch(/Version \d+\.\d+\.\d+/);
  });
});
