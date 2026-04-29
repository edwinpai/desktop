// - Happy path: Gateway mode full flow
// - Happy path: Client mode full flow
// - Skip channels, complete minimal setup
// - Test all 6 channel platforms
// - Verify persistence across app restart

// onboarding-validation.spec.ts (8-10 scenarios):
// - Invalid API key rejection
// - Invalid petname formats
// - Port conflict detection
// - Subscription validation failures
// - Channel credential validation

// onboarding-persistence.spec.ts (6-8 scenarios):
// - Resume from each step (7 tests)
// - Clear onboarding state on completion
// - Export/import config
