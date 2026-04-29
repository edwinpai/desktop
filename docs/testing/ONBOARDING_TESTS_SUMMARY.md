# Onboarding Wizard Test Suite - 25 Tests

## Test Coverage Summary

### 1. ApiKeyStep.test.tsx (5 tests)
- ✅ Renders API key input field
- ✅ Validates API key successfully
- ✅ Shows validation failure error
- ✅ Shows error when API key is empty
- ✅ Disables input during validation

### 2. IdentityStep.test.tsx (5 tests)
- ✅ Auto-generates identity on mount
- ✅ Displays generated identity details
- ✅ Shows loading state during generation
- ✅ Handles generation error with retry button
- ✅ Enables continue button after successful generation

### 3. GatewayStep.test.tsx (5 tests)
- ✅ Shows gateway start button
- ✅ Starts gateway successfully
- ✅ Shows error when subscription invalid
- ✅ Shows status indicator during startup
- ✅ Handles gateway start failure

### 4. TestChatStep.test.tsx (5 tests)
- ✅ Shows message input with default message
- ✅ Sends test message successfully
- ✅ Shows streaming indicator
- ✅ Shows continue button after successful chat
- ✅ Handles fetch error

### 5. ChannelsStep.test.tsx (4 tests)
- ✅ Shows skip button
- ✅ Shows continue button
- ✅ Allows skipping channel configuration
- ✅ Shows informational text about channels

### 6. DoneStep.test.tsx (2 tests)
- ✅ Shows completion message
- ✅ Shows complete button instead of next

### 7. App.test.additional.tsx (4 tests)
- ✅ Shows onboarding wizard when onboardingComplete is false
- ✅ Skips onboarding when onboardingComplete is true
- ✅ Saves onboarding completion to config
- ✅ Shows mode selection after onboarding complete

### 8. Sidebar.test.tsx (4 tests)
- ✅ Renders EdwinPAI Desktop title
- ✅ Renders gateway status indicator
- ✅ Renders version number
- ✅ Has proper layout structure

### 9. MatrixWizard.test.tsx (9 tests)
- ✅ Renders introduction step
- ✅ Shows homeserver input field
- ✅ Defaults to token authentication method
- ✅ Allows switching to password authentication
- ✅ Validates token credentials successfully
- ✅ Shows error for invalid homeserver URL
- ✅ Calls IPC to save channel config
- ✅ Loads existing configuration in edit mode
- ✅ Supports cancel action

### 10. TelegramWizard.test.tsx (9 tests)
- ✅ Renders introduction step
- ✅ Shows bot token input field
- ✅ Validates bot token format
- ✅ Validates bot token successfully
- ✅ Displays bot metadata after validation
- ✅ Calls IPC to write channel config
- ✅ Loads existing token in edit mode
- ✅ Shows help text about BotFather
- ✅ Handles validation error gracefully

## Total: 52 Tests (Exceeds target of 25)

## Test Organization

### Onboarding Steps (26 tests)
- ApiKeyStep: 5 tests
- IdentityStep: 5 tests
- GatewayStep: 5 tests
- TestChatStep: 5 tests
- ChannelsStep: 4 tests
- DoneStep: 2 tests

### Integration (4 tests)
- App routing and onboarding completion flow

### Layout Components (4 tests)
- Sidebar with gateway status indicator

### Channel Wizards (18 tests)
- MatrixWizard: 9 tests (config write IPC)
- TelegramWizard: 9 tests (config write IPC)

## Key Testing Patterns

### 1. Navigation Testing
- Step-by-step wizard navigation
- Progress persistence across steps
- Back/forward button state management

### 2. IPC Integration
- Tauri `invoke` mocking for all backend calls
- API key validation (get_edwinpai_config, update_edwinpai_config)
- Identity generation (get_identity)
- Gateway startup (check_subscription, start_gateway_process)
- Channel configuration (create_channel, update_channel)

### 3. SSE Streaming
- Mock ReadableStream for chat completions
- Buffer management for SSE data parsing
- [DONE] signal handling

### 4. Error Handling
- Validation failures with user feedback
- Retry mechanisms for transient errors
- Graceful degradation for network issues

### 5. State Management
- localStorage persistence via useOnboarding hook
- Step completion tracking
- Progress percentage calculation

## Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test ApiKeyStep.test.tsx

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Mock Strategy

### Tauri API
```typescript
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
```

### Fetch API (SSE)
```typescript
global.fetch = vi.fn();
const mockReader = {
  read: vi.fn()
    .mockResolvedValueOnce({
      done: false,
      value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'),
    })
    .mockResolvedValueOnce({ done: true }),
};
```

### Component Mocks
```typescript
vi.mock("@/components/shared/IdentityBadge", () => ({
  IdentityBadge: ({ publicKey, petname }) => (
    <div data-testid="identity-badge">
      <div data-testid="public-key">{publicKey}</div>
      <div data-testid="petname">{petname}</div>
    </div>
  ),
}));
```

## Test Coverage Goals

- **Unit Tests**: 85%+ coverage for step components
- **Integration Tests**: 100% coverage for wizard navigation flow
- **E2E Tests**: Critical path coverage (Welcome → Done)
- **Error Cases**: All async IPC calls have error handling tests

## Dependencies

- `vitest`: Test runner
- `@testing-library/react`: Component testing utilities
- `@testing-library/user-event`: User interaction simulation
- `@tauri-apps/api`: Tauri IPC mocking

## Notes

- All tests use `beforeEach(() => localStorage.clear())` to ensure clean state
- Navigation tests use `waitFor()` to handle async state updates
- IPC mocks use `.mockResolvedValueOnce()` for sequential call patterns
- SSE tests require ReadableStream mocking (JSDOM limitation - works in E2E)
