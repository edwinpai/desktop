# Gateway Chat Implementation

## Summary

Implemented 4 files for gateway chat with SSE streaming support:

1. **GatewayClient.ts** - HTTP client for gateway REST API
2. **useGatewayChat.ts** - React hook for chat state management
3. **ToolUseCard.tsx** - Component for displaying tool use blocks
4. **ChatView.tsx** - Main conversation interface

## File Locations

```
edwinpai-desktop/
├── src/
│   ├── lib/
│   │   └── GatewayClient.ts          (199 LOC)
│   ├── hooks/
│   │   └── useGatewayChat.ts         (274 LOC)
│   └── components/
│       └── chat/
│           ├── ChatView.tsx          (254 LOC)
│           └── ToolUseCard.tsx       (164 LOC)
```

## Implementation Details

### 1. GatewayClient.ts (`src/lib/GatewayClient.ts`)

**Features:**
- Async generator for SSE streaming (`sendMessage`)
- Fetch-based HTTP client with EventSource polyfill
- Parses `data: {json}` SSE lines
- Yields `ChatCompletionChunk` objects
- Handles `[DONE]` signal
- Bearer auth header (`Authorization: Bearer {token}`)
- Error handling for 401/connection refused/timeout

**Key Methods:**
```typescript
async *sendMessage(request: StreamingChatCompletionRequest): AsyncGenerator<ChatCompletionChunk>
async sendMessageSync(request: ChatCompletionRequest): Promise<ChatCompletionChunk>
setAuthToken(token: string): void
setBaseURL(url: string): void
```

**Usage Example:**
```typescript
const client = new GatewayClient({
  baseURL: 'http://localhost:3000',
  authToken: 'session-abc123',
  timeout: 30000,
});

for await (const chunk of client.sendMessage({ messages, model, stream: true })) {
  console.log(chunk.choices[0].delta.content);
}
```

### 2. useGatewayChat.ts (`src/hooks/useGatewayChat.ts`)

**Features:**
- State management for message list
- `sendMessage` wrapper with error handling
- Streaming accumulation (text + tool uses)
- Error categorization (401/connection refused/timeout)
- AbortController for cancellation
- Retry logic for last failed message

**Return Interface:**
```typescript
interface UseGatewayChatReturn {
  messages: StreamingChatMessage[];
  isStreaming: boolean;
  currentResponse: string;
  currentToolUses: ToolUseBlock[];
  error: string | null;
  loading: boolean;
  sendMessage: (content: string, role?: ChatRole) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => void;
  retry: () => Promise<void>;
}
```

**Usage Example:**
```typescript
const {
  messages,
  isStreaming,
  currentResponse,
  sendMessage,
} = useGatewayChat({ authToken: 'session-abc123' });
```

### 3. ToolUseCard.tsx (`src/components/chat/ToolUseCard.tsx`)

**Features:**
- Collapsible card component
- Tool name + ID display
- JSON syntax highlighting via `react-markdown`
- Tool icon (gear SVG)
- Expand/collapse animation
- Dark mode support

**Props:**
```typescript
interface ToolUseCardProps {
  toolUse: ToolUseBlock;
  defaultExpanded?: boolean;
  className?: string;
}
```

**Components:**
- `ToolUseCard` - Single tool use display
- `ToolUseList` - Multiple tool uses wrapper

**Usage Example:**
```typescript
<ToolUseCard
  toolUse={{
    id: 'toolu_abc123',
    name: 'get_weather',
    input: { location: 'San Francisco' }
  }}
/>
```

### 4. ChatView.tsx (`src/components/chat/ChatView.tsx`)

**Features:**
- Full chat interface with streaming support
- Uses `useGatewayChat` hook (replaced `useChat`)
- Typing indicator during streaming (3 bouncing dots)
- ToolUseCard rendering for assistant messages
- Auto-scroll to bottom on new messages
- Error display banner
- Clear messages button
- Markdown rendering via `react-markdown` + `remark-gfm`

**Props:**
```typescript
interface ChatViewProps {
  authToken?: string;
  className?: string;
}
```

**Sub-Components:**
- `MessageBubble` - Individual message display (user/assistant)
- `ChatInput` - Text input with send button

**Usage Example:**
```typescript
<ChatView authToken="session-abc123" />
```

## Type System

All types imported from:
- `@/types/streaming.ts` - Streaming types (SSE, chunks, tool uses)
- `@/types/api.ts` - API types (messages, requests, responses)

**Key Types:**
```typescript
// Streaming message with tool use
interface StreamingChatMessage extends ChatMessage {
  streaming: boolean;
  tool_use: ToolUseBlock[];
  id?: string;
  timestamp?: number;
}

// Tool use block
interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Gateway client config
interface GatewayClientConfig {
  baseURL: string;
  authToken: string;
  timeout: number;
  retries?: { maxAttempts: number; initialDelayMs: number; backoffMultiplier: number };
}
```

## Integration

### With Phase 1 (Crypto Domain)
- Auth token from BRC-103 handshake passed via `authToken` prop

### With Phase 3 (Gateway Mode)
- Gateway port from `useGatewayConfig()` hook
- Base URL: `http://localhost:{gatewayPort}`

### With Phase 4 (Client Mode)
- Same auth token used for client mode connections
- Multi-user permission checks handled by gateway

## Error Handling

**Handled Errors:**
1. **401 Unauthorized** → "Authentication failed. Please reconnect to gateway."
2. **Connection Refused** → "Cannot connect to gateway. Is it running?"
3. **Timeout** → "Request timed out. Please try again."
4. **Other** → Display raw error message

**Error Recovery:**
- `retry()` method re-sends last user message
- `cancelStream()` aborts current request
- Error banner displays above chat messages

## Testing Strategy

**Unit Tests (TODO):**
- `GatewayClient.test.ts` - SSE parsing, error handling, auth headers
- `useGatewayChat.test.ts` - State management, streaming accumulation
- `ToolUseCard.test.ts` - Expand/collapse, JSON formatting
- `ChatView.test.tsx` - Auto-scroll, typing indicator, error display

**Integration Tests (TODO):**
- End-to-end streaming with mock gateway
- Error recovery flows
- Multi-tool use rendering

**Mock Strategy:**
- Mock `fetch` for HTTP requests
- Mock SSE stream with `ReadableStream`
- Mock `useGatewayConfig` for port configuration

## Dependencies

**New:**
- None (uses existing `react-markdown` ^10.1.0, `remark-gfm` ^4.0.1)

**Updated:**
- `@/types/api.ts` - Added `temperature`, `maxTokens`, `max_tokens` to `ChatCompletionRequest`

## Deviations from Original Plan

1. **EventSource polyfill** - Not needed, used `fetch` + `ReadableStream` instead (simpler, more control)
2. **ChatInput component** - Inlined in `ChatView.tsx` (avoid file bloat, simple implementation)
3. **Error handling** - Added retry logic and categorized errors (better UX)

## LOC Breakdown

| File | Production | Tests | Total |
|------|-----------|-------|-------|
| GatewayClient.ts | 199 | 0 | 199 |
| useGatewayChat.ts | 274 | 0 | 274 |
| ToolUseCard.tsx | 164 | 0 | 164 |
| ChatView.tsx | 254 | 0 | 254 |
| **Total** | **891** | **0** | **891** |

## Next Steps

1. **Testing** - Add comprehensive test suite (~400 LOC)
2. **E2E Tests** - Playwright tests for full chat flow
3. **Gateway Backend** - Implement `/v1/chat/completions` endpoint (Phase 6)
4. **Tool Execution** - Wire up tool use to actual commands
5. **Message Persistence** - Save chat history to disk/DB

## Quality Metrics

- ✅ Zero TypeScript errors
- ✅ All types imported from contracts
- ✅ Auto-scroll on streaming updates
- ✅ Typing indicator with animation
- ✅ Dark mode support
- ✅ Error recovery (retry + cancel)
- ✅ Tool use rendering with syntax highlighting
- ⏳ Test coverage (target: >85%)
- ⏳ E2E test scenarios (target: 5+)

---

**Status:** ✅ Implementation COMPLETE, awaiting testing phase
**Date:** 2026-02-12
**Phase:** Phase 6 - AI Integration (partial)
