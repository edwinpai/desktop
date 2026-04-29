/**
 * Channel Config Editor — functional E2E tests
 *
 * Verifies that the config editor loads real values from the gateway,
 * allows editing, saves via config.patch, and round-trips correctly.
 *
 * Prerequisite: Matrix channel must be configured on the local gateway.
 */

// Helper: wait for the app to finish loading
async function waitForApp() {
  const body = await $('body');
  await body.waitForExist({ timeout: 10000 });
  await browser.waitUntil(async () => {
    const text = await body.getText();
    return !text.includes('Loading Edwin Desktop') && text.includes('Edwin Desktop');
  }, { timeout: 15000, timeoutMsg: 'App did not finish loading within 15s' });
  return body;
}

// Helper: navigate to a sidebar section
async function navigateTo(section) {
  const navItems = await $$('nav a, nav button, aside a, aside button');
  for (const item of navItems) {
    const text = await item.getText();
    if (text.includes(section)) {
      await item.click();
      break;
    }
  }
  await browser.pause(500);
}

// Helper: click the Edit button on the Matrix channel card.
// From the DOM, the Matrix card has 3 buttons:
//   [0] = Switch (enable toggle), [1] = Edit (square-pen SVG), [2] = Trash (delete)
// We need button[1] — the one with lucide-square-pen class.
async function clickEditOnMatrix() {
  // Find all cards with [class*="card"]
  const cards = await $$('[class*="card"]');
  for (const card of cards) {
    const text = await card.getText();
    if (text.includes('Matrix') && text.includes('Enable')) {
      // This is the main Matrix channel card (has Enable toggle)
      const buttons = await card.$$('button');
      // button[1] is the edit button (square-pen icon)
      if (buttons.length >= 2) {
        await buttons[1].click();
        await browser.pause(1000);
        return true;
      }
    }
  }
  return false;
}

describe('Channel Config Editor - Navigation', () => {
  it('should navigate to Channels and show Matrix', async () => {
    await waitForApp();
    await navigateTo('Channels');

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Channel Integrations');
    expect(text).toContain('Matrix');
  });

  it('should open the config editor when clicking Edit on Matrix', async () => {
    const clicked = await clickEditOnMatrix();
    expect(clicked).toBe(true);

    // Wait for the config editor to render — it fetches config via WebSocket
    await browser.waitUntil(async () => {
      const body = await $('body');
      const text = await body.getText();
      return text.includes('Matrix Settings');
    }, { timeout: 15000, timeoutMsg: 'Config editor did not appear within 15s' });

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Matrix Settings');
  });
});

describe('Channel Config Editor - Field Rendering', () => {
  it('should show the gateway target label', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toMatch(/localhost|127\.0\.0\.1/);
  });

  it('should render section headers', async () => {
    const body = await $('body');
    const text = await body.getText();
    // Sections from the grouped config editor
    expect(text).toContain('Credentials');
    expect(text).toContain('Access Control');
    expect(text).toContain('Messaging');
    expect(text).toContain('Save Changes');
  });

  it('should render credential fields (default open)', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Homeserver URL');
    expect(text).toContain('User ID');
    expect(text).toContain('Channel Name');
    expect(text).toContain('Enabled');
  });

  it('should render access control fields (default open)', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Group Policy');
    expect(text).toContain('Auto-Join Invites');
  });

  it('should render messaging fields (default open)', async () => {
    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Group History Limit');
    expect(text).toContain('DM History Limit');
  });

  it('should load the homeserver value from gateway', async () => {
    // Wait for the async config fetch to populate the input
    await browser.waitUntil(async () => {
      const val = await browser.execute(() => {
        const el = document.getElementById('field-homeserver');
        return el ? el.value : '';
      });
      return val && val.length > 0;
    }, { timeout: 15000, timeoutMsg: 'Homeserver input never populated' });

    const value = await browser.execute(() => document.getElementById('field-homeserver').value);
    expect(value).toContain('matrix');
  });

  it('should load the userId value from gateway', async () => {
    const value = await browser.execute(() => {
      const el = document.getElementById('field-userId');
      return el ? el.value : '';
    });
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain('@');
  });
});

describe('Channel Config Editor - Save Round-Trip', () => {
  it('should set a channel name, save, and see confirmation', async () => {
    // Wait for config to be loaded first
    await browser.waitUntil(async () => {
      const val = await browser.execute(() => {
        const el = document.getElementById('field-homeserver');
        return el ? el.value : '';
      });
      return val && val.length > 0;
    }, { timeout: 15000, timeoutMsg: 'Config not loaded before save test' });

    // Use React-compatible value setting via nativeInputValueSetter
    await browser.execute(() => {
      const el = document.getElementById('field-name');
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeInputValueSetter.call(el, 'E2E-Test-Matrix');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click Save Changes
    const buttons = await $$('button');
    for (const btn of buttons) {
      const text = await btn.getText();
      if (text.includes('Save')) {
        await btn.click();
        break;
      }
    }

    // Wait for save confirmation
    await browser.waitUntil(async () => {
      const body = await $('body');
      const text = await body.getText();
      return text.includes('Saved to') || text.includes('No changes');
    }, { timeout: 15000, timeoutMsg: 'Save confirmation did not appear within 15s' });

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Saved to');
  });

  it('should persist the saved value after refresh', async () => {
    // Wait for gateway restart after config.patch
    await browser.pause(4000);

    // Click the Refresh button (the one with RefreshCw icon near the title)
    const buttons = await $$('button');
    for (const btn of buttons) {
      const html = await btn.getHTML(true);
      if (html.includes('refresh-cw') || html.includes('RefreshCw')) {
        await btn.click();
        break;
      }
    }

    // Wait for reload to complete with our saved value
    await browser.waitUntil(async () => {
      const nameInput = await $('#field-name');
      if (await nameInput.isExisting()) {
        const val = await nameInput.getValue();
        return val === 'E2E-Test-Matrix';
      }
      return false;
    }, { timeout: 15000, timeoutMsg: 'Config did not reload with saved value' });

    const nameInput = await $('#field-name');
    const value = await nameInput.getValue();
    expect(value).toBe('E2E-Test-Matrix');
  });

  it('should report no changes when saving without edits', async () => {
    await browser.pause(500);

    const buttons = await $$('button');
    for (const btn of buttons) {
      const text = await btn.getText();
      if (text.includes('Save')) {
        await btn.click();
        break;
      }
    }

    await browser.waitUntil(async () => {
      const body = await $('body');
      const text = await body.getText();
      return text.includes('No changes') || text.includes('Saved to');
    }, { timeout: 10000 });

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('No changes');
  });

  // Cleanup: clear the test channel name
  after(async () => {
    try {
      const nameInput = await $('#field-name');
      if (await nameInput.isExisting()) {
        await nameInput.clearValue();
        const buttons = await $$('button');
        for (const btn of buttons) {
          const text = await btn.getText();
          if (text.includes('Save')) {
            await btn.click();
            break;
          }
        }
        await browser.pause(4000);
      }
    } catch {
      // Best effort cleanup
    }
  });
});

describe('Channel Config Editor - Done Button', () => {
  it('should return to channel list when clicking Done', async () => {
    const buttons = await $$('button');
    for (const btn of buttons) {
      const text = await btn.getText();
      if (text === 'Done') {
        await btn.click();
        break;
      }
    }
    await browser.pause(500);

    const body = await $('body');
    const text = await body.getText();
    expect(text).toContain('Channel Integrations');
  });
});
