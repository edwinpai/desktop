# E2E Test Suite - EdwinPAI Desktop

End-to-end tests for EdwinPAI Desktop using Playwright and the Page Object pattern.

## 📁 Test Files

| File | Scenarios | Coverage |
|------|-----------|----------|
| `onboarding-walkthrough.spec.ts` | 11 | Complete onboarding flows (gateway + client) |
| `chat-flow.spec.ts` | 15 | Chat messaging, SSE streaming, persistence |
| `channel-wizard.spec.ts` | 18 | Channel creation for 6 platforms |
| `settings.spec.ts` | 15 | Configuration, permissions, validation |
| `mode-switching.spec.ts` | 11 | Gateway ↔ Client switching |
| `client-mode.spec.ts` | 6 | mDNS discovery, BRC-103 handshake |
| `access-control.spec.ts` | 5 | Invitations, multi-user, permissions |

**Total**: 79 test scenarios across 7 files

## 🛠️ Helper Utilities

### Page Objects (`helpers/test-setup.ts`)

```typescript
import { OnboardingPage, ChatPage, SettingsPage, ChannelsPage } from './helpers/test-setup';

// Example usage
const onboarding = new OnboardingPage(page);
await onboarding.selectMode('gateway');
await onboarding.completeGatewaySetup();

const chat = new ChatPage(page);
await chat.sendMessage('Hello!');
await chat.verifyMessageExists('Hello!');
```

### Helper Functions

- `setupCompleteEnvironment(page, mode)` - Quick setup to initialized state
- `waitForGatewayReady(page)` - Poll until gateway is running
- `setMockUserRole(page, role)` - Mock owner/member/guest for permission tests
- `getConfig(page)` - Retrieve backend config via IPC
- `clearLocalStorage(page)` - Reset chat history
- `seedChatHistory(page, messages)` - Pre-populate chat for testing

### Test Data Factories

```typescript
import { TestData } from './helpers/test-setup';

const token = TestData.validTelegramToken(); // "123456789:ABCdef..."
const session = TestData.validWhatsAppSession(); // { clientId, serverToken, ... }
const channelName = TestData.uniqueChannelName('WhatsApp'); // "WhatsApp Channel 1739345678"
```

## 🚀 Running Tests

### Development

```bash
# Run all E2E tests
npm run test:e2e

# Run specific file
npx playwright test e2e/chat-flow.spec.ts

# Run specific test
npx playwright test -g "should send a message"

# Debug mode (headed browser)
npx playwright test --headed --debug

# Interactive UI mode
npm run test:e2e:ui
```

### Watch Mode

```bash
# Re-run on file changes
npx playwright test --watch
```

### CI/CD

```bash
# Install dependencies (includes browsers)
npx playwright install --with-deps

# Run in CI (headless, retries enabled)
npm run test:e2e
```

## 📝 Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: navigate to app
    await page.goto('tauri://localhost');
  });

  test('should perform action', async ({ page }) => {
    // Arrange
    const button = page.getByRole('button', { name: 'Click Me' });

    // Act
    await button.click();

    // Assert
    await expect(page.getByText('Success!')).toBeVisible();
  });
});
```

### Using Page Objects

```typescript
import { test, expect } from '@playwright/test';
import { setupCompleteEnvironment, ChatPage } from './helpers/test-setup';

test.describe('Chat Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Quick setup to initialized state
    await setupCompleteEnvironment(page, 'gateway');
  });

  test('should send message', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.sendMessage('Test message');
    await chat.verifyMessageExists('Test message');
  });
});
```

### Testing Permissions

```typescript
import { setMockUserRole } from './helpers/test-setup';

test('should restrict guest access', async ({ page }) => {
  await page.goto('tauri://localhost');
  await setMockUserRole(page, 'guest');

  // Guest should not see admin features
  const adminButton = page.getByRole('button', { name: 'Admin' });
  await expect(adminButton).not.toBeVisible();
});
```

## 🎯 Test Organization

### File Naming Convention
- `<feature>-<action>.spec.ts` (e.g., `chat-flow.spec.ts`, `channel-wizard.spec.ts`)
- Use kebab-case for filenames
- One feature area per file

### Test Naming Convention
- Use `should` prefix: `should send message and display in history`
- Be descriptive: include what is tested and expected outcome
- Use `test.describe()` for logical grouping

### Test Structure
```typescript
test.describe('Feature Area', () => {
  test.beforeEach(async ({ page }) => {
    // Common setup
  });

  test('should perform expected action', async ({ page }) => {
    // 1. Arrange - set up test conditions
    // 2. Act - perform the action
    // 3. Assert - verify the outcome
  });

  test('should handle error case', async ({ page }) => {
    // Test failure scenarios
  });
});
```

## 🔍 Debugging Tips

### Visual Debugging

```bash
# Open Playwright Inspector
npx playwright test --debug

# Take screenshots on failure (automatic in CI)
# Screenshots saved to: test-results/
```

### Trace Viewer

```bash
# Run with tracing (automatic on first retry)
npx playwright test --trace on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Console Logs

```typescript
// Access browser console
page.on('console', msg => console.log('BROWSER:', msg.text()));

// Access Tauri IPC logs
page.on('pageerror', error => console.error('PAGE ERROR:', error));
```

## ⚙️ Configuration

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run tauri dev',
    url: 'tauri://localhost',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Timeouts

- **Test timeout**: 30s (default)
- **Action timeout**: 5s (default)
- **Gateway startup**: 10s (custom wait)
- **mDNS discovery**: 5s (spec requirement)

## 📊 Coverage Goals

- **Critical paths**: 100% (9/9 ✅)
- **User journeys**: 100% (8/8 ✅)
- **Platform support**: 100% (6/6 ✅)
- **Permission levels**: 100% (3/3 ✅)
- **Error scenarios**: 90%+ (13 negative tests)

## 🐛 Common Issues

### Issue: Test timeout on gateway startup

```typescript
// Solution: Increase timeout for gateway-dependent tests
test('should start gateway', async ({ page }) => {
  await page.goto('tauri://localhost');
  // Wait up to 10s for gateway
  await waitForGatewayReady(page, 10000);
}, { timeout: 60000 }); // Increase test timeout
```

### Issue: Flaky tests due to SSE streaming

```typescript
// Solution: Use deterministic waits
await chat.sendMessage('Test');
await page.waitForTimeout(1000); // Wait for stream to start
await expect(page.getByText(/response/i)).toBeVisible();
```

### Issue: localStorage not persisting

```typescript
// Solution: Reload page to trigger restoration
await localStorage.setItem('key', 'value');
await page.reload(); // Trigger load from storage
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
- [Page Object Pattern](https://playwright.dev/docs/pom)
- [Full Test Manifest](../E2E_TEST_MANIFEST.md)

## 🤝 Contributing

When adding new E2E tests:

1. **Check existing coverage**: Review `E2E_TEST_MANIFEST.md` to avoid duplication
2. **Use page objects**: Extract common interactions to `helpers/test-setup.ts`
3. **Follow naming conventions**: `feature-action.spec.ts`, `should` prefix for tests
4. **Test both success and failure**: Include error scenarios
5. **Keep tests isolated**: Use `beforeEach` for setup, avoid dependencies between tests
6. **Update manifest**: Document new tests in `E2E_TEST_MANIFEST.md`

## ✅ Quality Checklist

Before submitting:

- [ ] Tests pass locally (`npm run test:e2e`)
- [ ] Tests pass in CI (headless mode)
- [ ] Page objects used where applicable
- [ ] Error scenarios covered
- [ ] Test timeout < 30s
- [ ] No hardcoded waits (use `waitFor*` methods)
- [ ] Manifest updated with new test count
- [ ] Follows naming conventions
