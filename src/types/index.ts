export type {
  SignRequest,
  SignResponse,
  VerifyRequest,
  VerifyResponse,
  GetPublicKeyRequest,
  GetPublicKeyResponse,
  CheckSubscriptionRequest,
  CheckSubscriptionResponse,
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  DecryptResponse,
  DeriveKeyRequest,
  DeriveKeyResponse,
  SignMessageRequest,
  SignMessageResponse,
  GetIdentityRequest,
  GetIdentityResponse,
  GenerateIdenticonRequest,
  GenerateIdenticonResponse,
  GetAuditLogRequest,
  GetAuditLogResponse,
  AuditLogEntry as IpcAuditLogEntry,
  AuthorizeSpendRequest,
  AuthorizeSpendResponse,
  SpvVerifyRequest,
  SpvVerifyResponse,
  SubmitToArcadeRequest,
  SubmitToArcadeResponse,
  CryptoRequest,
  CryptoResponse,
  CryptoMessage,
} from "./ipc";

export type {
  BsvAuthHeaders,
  ChatRole,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChunkChoice,
  ChatCompletionChunk,
  ChatCompletionChoice,
  ChatCompletionResponse,
  IdentityResponse,
  SubscriptionUtxo,
  SubscriptionResponse,
  SubscriptionStatusResponse,
  UserEntry,
  UserRecord,
  UsersResponse,
  InviteRequest,
  InviteResponse,
  DeleteUserResponse,
  RedeemInviteRequest,
  RedeemInviteResponse,
  ChannelStatus,
  ChannelEntry,
  ChannelsResponse,
  UpdateChannelRequest,
  ChannelUpdateRequest,
  UpdateChannelResponse,
  HealthResponse,
  ErrorCode,
  ApiError,
  ErrorResponse,
} from "./api";
export { ErrorCodeEnum, ERROR_HTTP_STATUS } from "./api";

export type {
  Petname,
  PetnameWordLists,
  PetnameConfig,
  IdenticonConfig,
  IdenticonResult,
  Identity,
  IdentityDisplay,
  Brc42Context,
  DerivedIdentity,
  IdentityGenerationResult,
} from "./identity";

export type {
  SubscriptionState,
  UtxoRef,
  CachedProof,
  SubscriptionInfo,
  SubscriptionStatus,
} from "./subscription";
export { SUBSCRIPTION_BEHAVIORS } from "./subscription";

export type {
  ChannelName,
  ChannelSettings,
  ChannelConfig,
  WizardStep,
  WizardState,
} from "./channels";

export type {
  PermissionLevel,
  PermissionCapabilities,
  OwnerPermissions,
  MemberPermissions,
  GuestPermissions,
  AuthorizedUser,
  AuthorizedUsersStore,
  InvitationPayload,
} from "./access";
export { PERMISSION_MATRIX } from "./access";

export type {
  Brc42DerivationParams,
  InvoiceNumber,
  SigningRequest,
  SigningResponse,
  VerificationRequest,
  VerificationResponse,
  EncryptionRequest,
  EncryptionResponse,
  DecryptionRequest,
  DecryptionResponse,
  PublicKeyInfo,
  CryptoError,
} from "./crypto";

export type {
  AuditOperation,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResponse,
  AuditStats,
  AuditLogFileFormat,
} from "./audit";

export type {
  BeefEnvelope,
  BRC62Transaction,
  TransactionInput,
  TransactionOutput,
  MerkleProof,
  MerkleProofNode,
  CompactMerklePath,
  BlockHeader,
  SpvVerification,
  SubscriptionUtxo as SpvSubscriptionUtxo,
  SpvProofCache,
  BeefParseOptions,
  BeefSerialized,
} from "./spv";

export type {
  OverlayTopic,
  AdmissionRules,
  TopicManager,
  ArcadeSubmission,
  SteakReceipt,
  TopicSubmissionResult,
  UtxoFilter,
  UtxoQueryResult,
  TopicUtxo,
  TopicSubscription,
  TopicEvent,
  UtxoAddedEvent,
  UtxoSpentEvent,
  UtxoConfirmedEvent,
  TopicUpdatedEvent,
  ArcadeConfig,
} from "./overlay";
export { DEFAULT_ARCADE_CONFIG } from "./overlay";

export type {
  IdentitySetupProps,
  IdentitySetupStepProps,
  SetupIdentity,
  WelcomeStepProps,
  GenerateKeyStepProps,
  ReviewIdentityStepProps,
  BackupKeyStepProps,
  ConfirmBackupStepProps,
  CompleteStepProps,
  IdentityCardProps,
  IdenticonProps,
  PetnameDisplayProps,
  RecoveryPhraseDisplayProps,
  RecoveryPhraseInputProps,
  ImportKeyProps,
  ImportKeyFormProps,
} from "./identity-setup";
export { IdentitySetupStep } from "./identity-setup";

// Gateway process management types
export type {
  GatewayStatus,
  GatewayProcessInfo,
  StartGatewayRequest,
  StartGatewayResponse,
  StopGatewayRequest,
  StopGatewayResponse,
  GetGatewayStatusRequest,
  GetGatewayStatusResponse,
  HealthCheckResponse,
  PerformHealthCheckRequest,
  PerformHealthCheckResponse,
  MDnsConfig,
  MDnsStatus,
  StartMDnsRequest,
  StartMDnsResponse,
  StopMDnsRequest,
  StopMDnsResponse,
  GetMDnsStatusRequest,
  GetMDnsStatusResponse,
  GatewayConfig,
  GatewayProcessEvent,
  GatewayProcessEventPayload,
} from "./gateway";
export { DEFAULT_GATEWAY_CONFIG as DEFAULT_GATEWAY_CONFIG_PHASE3 } from "./gateway";

// Chat and SSE streaming types
export type {
  MessageRole,
  MessageContentPart,
  MessageContent,
  ChatMessage as ChatMessageType,
  Conversation,
  ChatCompletionRequest as ChatCompletionRequestType,
  ChatCompletionResponse as ChatCompletionResponseType,
  SSEEventType,
  SSEEvent,
  MessageStartEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageDeltaEvent,
  MessageStopEvent,
  ErrorEvent,
  SSEStreamEvent,
  StreamingState,
  StreamingSession,
  StreamingProgress,
  SendChatMessageRequest,
  SendChatMessageResponse,
  CancelStreamRequest,
  CancelStreamResponse,
  GetConversationHistoryRequest,
  GetConversationHistoryResponse,
  ListConversationsRequest,
  ListConversationsResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  DeleteConversationRequest,
  DeleteConversationResponse,
  ChatEvent,
  StreamChunkEventPayload,
  StreamEndEventPayload,
  StreamErrorEventPayload,
} from "./chat";

// Desktop configuration types
export type {
  ThemePreference,
  ChatConfig,
  GatewayProfile,
  WorkspaceProfile,
  GatewayConfigSubset,
  DesktopConfig,
  PartialDesktopConfig,
} from "./config";
export {
  DEFAULT_CHAT_CONFIG,
  DEFAULT_GATEWAY_PROFILE,
  DEFAULT_WORKSPACE_PROFILE,
  DEFAULT_GATEWAY_CONFIG_SUBSET,
  DEFAULT_DESKTOP_CONFIG,
  getActiveGatewayProfile,
  getVaultNamespace,
  isValidTheme,
  isValidChatConfig,
  isValidGatewayProfile,
  isValidWorkspaceProfile,
  isValidGatewayConfigSubset,
  isValidDesktopConfig,
  mergeWithDefaults,
  sanitizeConfig,
} from "./config";

// Re-export Tauri command types (snake_case for Rust serde)
export type {
  GetIdentityResponse as TauriGetIdentityResponse,
  GetAuthIdentityResponse as TauriGetAuthIdentityResponse,
  SignChallengeResponse as TauriSignChallengeResponse,
  DeriveKeyRequest as TauriDeriveKeyRequest,
  DeriveKeyResponse as TauriDeriveKeyResponse,
  SignMessageRequest as TauriSignMessageRequest,
  SignMessageResponse as TauriSignMessageResponse,
  VerifyMessageRequest as TauriVerifyMessageRequest,
  VerifyMessageResponse as TauriVerifyMessageResponse,
  GenerateIdenticonRequest as TauriGenerateIdenticonRequest,
  GenerateIdenticonResponse as TauriGenerateIdenticonResponse,
} from "./tauri-commands";

// PHASE 4: Client Mode & Multi-User Authorization types
export type {
  // Client connection management
  ClientConnectionStatus,
  ClientConnection,
  DiscoveredPeer,
  PeerDiscoveryResult,
  PeerDiscoveryMethod,
  ClientConfig,
  ConnectToGatewayRequest,
  ConnectToGatewayResponse,
  DisconnectFromGatewayRequest,
  DisconnectFromGatewayResponse,
  GetClientConnectionRequest,
  GetClientConnectionResponse,
  DiscoverPeersRequest,
  DiscoverPeersResponse,
  AddPeerManuallyRequest,
  AddPeerManuallyResponse,
  ConnectionStatusChangedEvent,
  PeerDiscoveredEvent,
  ReconnectionAttemptEvent,
  ConnectionErrorEvent,
} from "./client";
export { DEFAULT_CLIENT_CONFIG } from "./client";

export type {
  // Multi-user authorization
  AccessLevel,
  AccessCapabilities,
  AuthUser,
  InvitationStatus,
  Invitation,
  Brc103AuthHeaders,
  InvitationDetails,
  InvitationData,
  // Auth IPC types
  ListUsersRequest,
  ListUsersResponse,
  GetUserRequest,
  GetUserResponse,
  RemoveUserRequest,
  RemoveUserResponse,
  UpdateUserActivityRequest,
  UpdateUserActivityResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  RedeemInvitationRequest,
  RedeemInvitationResponse,
  RevokeInvitationRequest,
  RevokeInvitationResponse,
  ListInvitationsRequest,
  ListInvitationsResponse,
  CheckAuthorizationRequest,
  CheckAuthorizationResponse,
  VerifyBrc103SignatureRequest,
  VerifyBrc103SignatureResponse,
  // Auth events
  UserAddedEvent,
  UserRemovedEvent,
  InvitationCreatedEvent,
  InvitationRedeemedEvent,
} from "./auth";
export {
  ACCESS_CAPABILITIES,
  canManageUsers,
  canWrite,
  canRead,
  parseInvitationData,
  encodeInvitationData,
} from "./auth";

// Re-export test types (only in test files via @/types/test)
// Note: Test types are exported from a separate entry point to avoid
// polluting production bundle with test infrastructure
export type {
  // Test Fixtures
  BRC42TestVector,
  BRC42TestVectorSuite,
  BRC42TestResult,
  SigningTestVector,
  VerificationTestCase,
  PetnameTestCase,
  IdenticonTestCase,
  IdentityTestFixture,
  // Mock Types
  MockTauriInvoke,
  TauriMockContext,
  CryptoDomainMockResponses,
  TauriMockBuilder,
  MockKeychainStorage,
  KeychainTestScenario,
  // Validation Helpers
  HexValidator,
  PublicKeyValidator,
  SignatureValidator,
  AuditLogValidator,
  TestAssertions,
  // Test Environment
  TestEnvironment,
  TestEnvironmentBuilder,
  TestUtilities,
  // Builders
  BRC42FixtureBuilder,
  IdentityFixtureBuilder,
  SigningFixtureBuilder,
  // Test Configuration
  TestSuiteConfig,
  TestRunnerOptions,
  TestResultSummary,
  TestData,
} from "./test";

// PHASE 4: Frontend UI Types (Discovery, Access Control, Settings, Routing)
export type {
  // Gateway Discovery
  DiscoveryScanStatus,
  DiscoveredPeerUI,
  DiscoveryScanState,
  DiscoveryActions,
  UseDiscoveryReturn,
  // Access Control
  PermissionLevel as Phase4PermissionLevel,
  InviteFormData,
  InvitationToken,
  UserWithPermissions,
  RevokeAction,
  AccessControlState,
  AccessControlActions,
  UseAccessControlReturn,
  // Settings
  OperatingMode,
  ModeSettings,
  ModeActions,
  UseModeReturn,
  // Routing
  Route,
  NavigationItem,
  RoutingState,
  RoutingActions,
  UseRoutingReturn,
  // Wizard/Onboarding
  ClientSetupStep,
  WizardStepState,
  WizardActions,
  UseWizardReturn,
} from "./phase4";

// PHASE 6: Requirements Document Type Contracts
export type {
  TaskGroup,
  ErrorInventory,
  SuccessCriteria,
  PhaseState,
  Phase6Requirements,
} from "./phase6";
export {
  isTaskGroup,
  isErrorInventory,
  isSuccessCriteria,
  isPhaseState,
} from "./phase6";

// PHASE 6: Onboarding Type Contracts
export type {
  OnboardingStepType,
  OnboardingStep,
  OnboardingProgress,
  StepComponentProps,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  GenerateIdentityRequest,
  GenerateIdentityResponse,
  StartGatewayRequest as OnboardingStartGatewayRequest,
  StartGatewayResponse as OnboardingStartGatewayResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateConfigRequest,
  UpdateConfigResponse,
} from "./onboarding";
export {
  OnboardingStep as OnboardingStepEnum,
  isStepRequired,
  isOnboardingComplete,
  getNextStep,
  getPreviousStep,
  calculateCompletionPercentage,
} from "./onboarding";

// PHASE 6: Auto-Updater Type Contracts
export type {
  UpdateInfo,
  UpdateConfig,
  DownloadProgress,
  UpdateCheckResult,
  DownloadUpdateRequest,
  DownloadUpdateResponse,
  CancelDownloadRequest,
  CancelDownloadResponse,
  GetUpdateStatusRequest,
  GetUpdateStatusResponse,
  SetUpdateConfigRequest,
  SetUpdateConfigResponse,
  UpdateStatusEvent,
} from "./updater";
export { UpdateStatus } from "./updater";

// PHASE 6: Error Boundary Type Contracts
export type {
  ErrorRecoveryAction,
  ErrorBoundaryState,
  ErrorRecoveryStrategy,
  ErrorBoundaryConfig,
  ErrorFallbackProps,
  LogErrorRequest,
  LogErrorResponse,
  GlobalErrorConfig,
  ErrorReport,
} from "./errors";
export { ErrorSeverity, ErrorCategory } from "./errors";

// PHASE 6: Extended API types (from api.ts)
export type {
  CheckForUpdatesRequest,
  CheckForUpdatesResponse,
  ApplyUpdateRequest,
  ApplyUpdateResponse,
} from "./api";

// Testing Infrastructure Types (Test Contracts & Mocks)
// Note: These are NEW types in testing.ts, separate from the old test.ts types
export type {
  // Integration test types (NEW)
  IPCTestScenario as IPCTestScenarioV2,
  SubscriptionFSMState as SubscriptionFSMStateV2,
  ChannelEncryptionTestCase,
  // Frontend test types (NEW)
  HookTestWrapper as HookTestWrapperV2,
  StoreTestFixture as StoreTestFixtureV2,
  E2EPageObject,
  MockRouter,
  CustomRenderOptions,
  CustomRenderResult,
  ComponentTestFixture,
  // Coverage schemas (NEW)
  CoverageThreshold as CoverageThresholdV2,
  CoverageReport as CoverageReportV2,
  TestManifest as TestManifestV2,
} from "./testing";
export {
  KeychainMock as KeychainMockV2,
  AuditLogMock as AuditLogMockV2,
  transitionSubscriptionState,
  calculatePassRate,
  meetsThreshold,
  TestFixtureBuilder as TestFixtureBuilderV2,
  BRC42FixtureBuilder as BRC42FixtureBuilderV2,
  IPCScenarioBuilder,
  TauriMockBuilder as TauriMockBuilderV2,
  waitForCondition,
  createMockSubscriptionState,
  DEFAULT_COVERAGE_THRESHOLD,
} from "./testing";

// PHASE 7: Polish, Testing & Distribution Types
export type {
  // Gateway process management
  GatewayProcessStatus,
  GatewayProcess,
  HealthStatus,
  ServiceHealth,
  GatewayHealth,
  // Gateway logging
  LogLevel,
  GatewayLog,
  LogQueryFilters,
  // EdwinPAI configuration
  OperatingMode as Phase7OperatingMode,
  ThemePreference as Phase7ThemePreference,
  GatewayConfigOptions,
  MdnsConfigOptions,
  UiPreferences,
  SubscriptionSettings as Phase7SubscriptionSettings,
  ClientSessionInfo,
  EdwinPAIConfig as Phase7EdwinPAIConfig,
  // Onboarding flow state
  OnboardingStepId as Phase7OnboardingStepIdLegacy,
  OnboardingStepStatus as Phase7OnboardingStepStatusLegacy,
  OnboardingStep as Phase7OnboardingStepLegacy,
  OnboardingProgress as Phase7OnboardingProgressLegacy,
  // Sidebar status indicators
  ConnectionStatus as Phase7ConnectionStatus,
  SubscriptionStatusIndicator,
  SidebarStatus,
  // Phase 7 IPC types
  StartGatewayProcessRequest,
  StartGatewayProcessResponse,
  StopGatewayProcessRequest,
  StopGatewayProcessResponse,
  RestartGatewayProcessRequest,
  RestartGatewayProcessResponse,
  GetGatewayProcessRequest,
  GetGatewayProcessResponse,
  GetGatewayHealthRequest,
  GetGatewayHealthResponse,
  GetGatewayLogsRequest,
  GetGatewayLogsResponse,
  GetEdwinPAIConfigRequest as Phase7GetEdwinPAIConfigRequest,
  GetEdwinPAIConfigResponse as Phase7GetEdwinPAIConfigResponse,
  UpdateEdwinPAIConfigRequest as Phase7UpdateEdwinPAIConfigRequest,
  UpdateEdwinPAIConfigResponse as Phase7UpdateEdwinPAIConfigResponse,
  ResetEdwinPAIConfigRequest as Phase7ResetEdwinPAIConfigRequest,
  ResetEdwinPAIConfigResponse as Phase7ResetEdwinPAIConfigResponse,
  GetOnboardingProgressRequest,
  GetOnboardingProgressResponse,
  UpdateOnboardingProgressRequest,
  UpdateOnboardingProgressResponse,
  ResetOnboardingProgressRequest,
  ResetOnboardingProgressResponse,
  GetSidebarStatusRequest,
  GetSidebarStatusResponse,
  // Phase 7 events
  GatewayProcessStatusChangedEvent,
  GatewayHealthChangedEvent,
  GatewayLogEvent,
  ConfigChangedEvent,
  OnboardingProgressUpdatedEvent,
} from "./phase7";
export {
  DEFAULT_GATEWAY_CONFIG as DEFAULT_GATEWAY_CONFIG_PHASE7,
  DEFAULT_MDNS_CONFIG,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  DEFAULT_EDWINPAI_CONFIG,
  LOG_LEVEL_ORDER,
  ONBOARDING_STEP_ORDER as ONBOARDING_STEP_ORDER_PHASE7,
  isGatewayRunning,
  canStartGateway,
  canStopGateway,
  isLogLevelAtLeast,
  calculateOnboardingCompletion,
  getNextOnboardingStep as getNextOnboardingStepPhase7,
  getPreviousOnboardingStep as getPreviousOnboardingStepPhase7,
} from "./phase7";

// PHASE 7: EdwinPAI Config Types (NEW - Configuration Management)
export type {
  // Complete EdwinPAI configuration (aliased to avoid duplicate with phase7.ts)
  EdwinPAIConfig as ApiEdwinPAIConfig,
  GatewayConfigFull,
  AiProviderConfig,
  MemoryConfig,
  IdentityConfig,
  SubscriptionUtxoRef,
  MdnsConfig,
  SubscriptionConfigFull,
  UiConfig as Phase7UiConfig,
  ConfigValidationError,
  ConfigErrorType,
  ConfigErrorDetail,
} from "./api";

// PHASE 7: IPC Config types (from ipc.ts, aliased to avoid duplicates)
export type {
  GetEdwinPAIConfigRequest as ApiGetEdwinPAIConfigRequest,
  GetEdwinPAIConfigResponse as ApiGetEdwinPAIConfigResponse,
  UpdateEdwinPAIConfigRequest as ApiUpdateEdwinPAIConfigRequest,
  UpdateEdwinPAIConfigResponse as ApiUpdateEdwinPAIConfigResponse,
  ResetEdwinPAIConfigRequest as ApiResetEdwinPAIConfigRequest,
  ResetEdwinPAIConfigResponse as ApiResetEdwinPAIConfigResponse,
} from "./ipc";

// PHASE 7: EdwinPAI Gateway Configuration & API Types (NEW)
export type {
  // Gateway configuration schema (~/.edwinpai/edwinpai.json)
  GatewayConfig as EdwinPAIGatewayConfig,
  // Gateway status API (/v1/status)
  GatewayStatus as EdwinPAIGatewayStatus,
  // Chat completion types
  ChatRole as EdwinPAIChatRole,
  TextContent as EdwinPAITextContent,
  ImageContent as EdwinPAIImageContent,
  ToolUseContent as EdwinPAIToolUseContent,
  ToolResultContent as EdwinPAIToolResultContent,
  ContentBlock as EdwinPAIContentBlock,
  ChatMessage as EdwinPAIChatMessage,
  ToolDefinition as EdwinPAIToolDefinition,
  ChatCompletionRequest as EdwinPAIChatCompletionRequest,
  ChatCompletionResponse as EdwinPAIChatCompletionResponse,
  // SSE streaming types
  SSEEventType as EdwinPAISSEEventType,
  SSEMessage as EdwinPAISSEMessage,
  MessageStartEvent as EdwinPAIMessageStartEvent,
  ContentBlockStartEvent as EdwinPAIContentBlockStartEvent,
  ContentBlockDeltaEvent as EdwinPAIContentBlockDeltaEvent,
  ContentBlockStopEvent as EdwinPAIContentBlockStopEvent,
  MessageDeltaEvent as EdwinPAIMessageDeltaEvent,
  MessageStopEvent as EdwinPAIMessageStopEvent,
  PingEvent as EdwinPAIPingEvent,
  ErrorEvent as EdwinPAISSEErrorEvent,
  // Tool use blocks
  ToolUseBlock as EdwinPAIToolUseBlock,
  ToolResultBlock as EdwinPAIToolResultBlock,
} from "./edwinpai-gateway";
export {
  extractText as extractTextFromEdwinPAIContent,
  extractToolUses as extractToolUsesFromEdwinPAIContent,
  isSubscriptionActive as isEdwinPAISubscriptionActive,
  isGatewayHealthy as isEdwinPAIGatewayHealthy,
} from "./edwinpai-gateway";

// PHASE 7: Gateway Process Lifecycle Types (NEW)
export type {
  // Gateway process state
  GatewayState as Phase7GatewayState,
  ProcessInfo as Phase7ProcessInfo,
  // Binary discovery
  BinaryDiscoveryStrategy,
  BinaryDiscovery,
  // Health check
  HealthCheck as Phase7HealthCheck,
  HealthCheckConfig as Phase7HealthCheckConfig,
  // Process lifecycle commands
  StartGatewayOptions,
  StopGatewayOptions,
  // Process events
  GatewayProcessEvent as Phase7GatewayProcessEvent,
  GatewayProcessEventPayload as Phase7GatewayProcessEventPayload,
} from "./gateway-lifecycle";
export {
  DEFAULT_HEALTH_CHECK_CONFIG as PHASE7_DEFAULT_HEALTH_CHECK_CONFIG,
  DEFAULT_START_OPTIONS as PHASE7_DEFAULT_START_OPTIONS,
  isRunning as isGatewayProcessRunning,
  canStart as canStartGatewayProcess,
  canStop as canStopGatewayProcess,
  isTransitioning as isGatewayTransitioning,
  needsRestart as gatewayNeedsRestart,
  calculateRestartDelay as calculateGatewayRestartDelay,
  formatUptime as formatGatewayUptime,
  validateBinaryPath,
} from "./gateway-lifecycle";

// PHASE 7: Onboarding Flow Types (Extended - NEW)
export type {
  // Onboarding steps
  OnboardingStepId as ExtendedOnboardingStepId,
  OnboardingStepStatus as ExtendedOnboardingStepStatus,
  OnboardingStep as ExtendedOnboardingStep,
  OnboardingState as ExtendedOnboardingState,
  // Step-specific data schemas
  IdentityStepData,
  BackupStepData,
  ModeSelectStepData,
  GatewaySetupStepData,
  ClientDiscoveryStepData,
  SubscriptionStepData,
  // Validation
  StepValidationResult,
  StepValidator,
  // Navigation
  OnboardingNavigation,
} from "./onboarding-phase7";
export {
  ONBOARDING_STEP_ORDER as EXTENDED_ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_METADATA,
  calculateCompletion as calculateExtendedOnboardingCompletion,
  getNextStep as getNextExtendedOnboardingStep,
  getPreviousStep as getPreviousExtendedOnboardingStep,
  isOnboardingComplete as isExtendedOnboardingComplete,
  getRequiredSteps as getRequiredOnboardingSteps,
  initializeOnboardingState,
} from "./onboarding-phase7";

// PHASE 7: SSE Streaming Types (NEW)
export type {
  // SSE message structure
  SSEMessage,
  // Chat completion delta (extends api.ts types)
  ChatCompletionDelta,
  // Tool use blocks
  ToolUseBlock,
  // Gateway client config
  GatewayClientConfig,
  // Streaming chat messages
  StreamingChatMessage,
  // Streaming session state (distinct from chat.ts StreamingState union)
  StreamingSessionState,
  StreamingChatCompletionRequest,
  StreamingChatCompletionResponse,
} from "./streaming";
export {
  isSSEMessage,
  isChatCompletionChunk,
  isChatCompletionDelta,
  isToolUseBlock,
  isValidGatewayClientConfig,
  isValidStreamingChatMessage,
  DEFAULT_GATEWAY_CLIENT_CONFIG,
  createInitialStreamingSessionState,
} from "./streaming";
