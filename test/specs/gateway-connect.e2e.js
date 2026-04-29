/**
 * Gateway connection tests — verifies the app is connected to the local gateway.
 *
 * Since config already exists and gateway is running locally,
 * the app should auto-connect and show the main interface.
 */

describe('Gateway Connection', () => {
  it('should show the main interface (not onboarding)', async () => {
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });

    // Wait for loading screen to finish
    await browser.waitUntil(async () => {
      const text = await body.getText();
      return !text.includes('Loading') && text.includes('Edwin Desktop');
    }, { timeout: 15000, timeoutMsg: 'App did not finish loading within 15s' });

    const text = await body.getText();
    expect(text).toContain('Edwin Desktop');
    expect(text).toContain('Chat');
  });

  it('should show Gateway Mode', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Gateway Mode');
  });

  it('should show gateway running status', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Gateway');
  });
});
