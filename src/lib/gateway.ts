// Gateway API client with BRC-103 authentication
//
// Implements complete BRC-103 authentication flow:
// 1. Initial request → nonce
// 2. Sign nonce with private key
// 3. Auth request with signature → session token
// 4. Authenticated requests with session token

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "@/types/api";
import { getIdentity, signMessage } from "@/lib/crypto-domain";

interface InitialRequest {
  publicKey: string;
}

interface InitialResponse {
  nonce: string;
}

interface AuthRequest {
  publicKey: string;
  nonce: string;
  signature: string;
}

interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  petname?: string;
  error?: string;
}

/**
 * BRC-103 authenticated gateway client
 */
export class GatewayClient {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private publicKey: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Perform BRC-103 authentication handshake
   */
  async authenticate(): Promise<{
    success: boolean;
    petname?: string;
    error?: string;
  }> {
    try {
      // Step 1: Get our public key from crypto domain
      const identityResponse = await getIdentity();
      this.publicKey = identityResponse.public_key;

      // Step 2: Initial request to get nonce
      const initialReq: InitialRequest = {
        publicKey: this.publicKey,
      };

      const initialResp = await fetch(`${this.baseUrl}/v1/auth/initial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(initialReq),
      });

      if (!initialResp.ok) {
        throw new Error(`Initial request failed: ${initialResp.status}`);
      }

      const initialData: InitialResponse = await initialResp.json();

      // Step 3: Sign the nonce
      const nonceBytes = new TextEncoder().encode(initialData.nonce);
      const signResponse = await signMessage({
        data: nonceBytes,
      });

      // Step 4: Auth request with signature
      const authReq: AuthRequest = {
        publicKey: this.publicKey,
        nonce: initialData.nonce,
        signature: this.bytesToHex(signResponse.signature),
      };

      const authResp = await fetch(`${this.baseUrl}/v1/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authReq),
      });

      if (!authResp.ok) {
        throw new Error(`Auth request failed: ${authResp.status}`);
      }

      const authData: AuthResponse = await authResp.json();

      if (!authData.success) {
        return {
          success: false,
          error: authData.error || "Authentication failed",
        };
      }

      this.sessionToken = authData.sessionToken || null;

      return {
        success: true,
        petname: authData.petname,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Make authenticated request to gateway
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!this.sessionToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.sessionToken}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Send chat completion request (non-streaming)
   */
  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.authenticatedRequest<ChatCompletionResponse>(
      "/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    );
  }

  /**
   * Send streaming chat completion request
   */
  async *chatCompletionStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.sessionToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const streamRequest = { ...request, stream: true };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(streamRequest),
    });

    if (!response.ok) {
      throw new Error(`Streaming request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get gateway health status
   */
  async health(): Promise<{ status: string; uptime?: number }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.sessionToken !== null;
  }

  /**
   * Get current public key
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.sessionToken = null;
    this.publicKey = null;
  }

  /**
   * Convert byte array to hex string
   */
  private bytesToHex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

/**
 * Create a new gateway client instance
 */
export function createGatewayClient(baseUrl: string): GatewayClient {
  return new GatewayClient(baseUrl);
}
