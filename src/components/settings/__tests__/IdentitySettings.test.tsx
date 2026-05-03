import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IdentitySettings } from "../IdentitySettings";

import * as cryptoDomain from "@/lib/crypto-domain";

vi.mock("@/lib/crypto-domain", () => ({
  getIdentity: vi.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe("IdentitySettings", () => {
  const mockPublicKey =
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
  const mockIdentity = {
    public_key: mockPublicKey,
    petname: "Happy Elephant",
    avatar_svg: "<svg>test identicon</svg>",
    short_id: "edw:a1b2c3d4",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cryptoDomain.getIdentity).mockResolvedValue(mockIdentity);
  });

  describe("Component Rendering", () => {
    it("renders loading state initially", async () => {
      vi.mocked(cryptoDomain.getIdentity).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockIdentity), 10)),
      );
      render(<IdentitySettings />);
      const loadingContainer = document.querySelector(".animate-pulse");
      expect(loadingContainer).toBeInTheDocument();

      await waitFor(
        () => {
          expect(screen.getByText("Your Identity")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("renders identity after loading", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText("Identity Settings")).toBeInTheDocument();
          expect(screen.getByText("Your Identity")).toBeInTheDocument();
          expect(screen.getByText("Happy Elephant")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("displays public key in monospace format", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          const pubkeyElement = screen.getByText(mockPublicKey);
          expect(pubkeyElement).toHaveClass("font-mono");
          expect(pubkeyElement.tagName).toBe("CODE");
        },
        { timeout: 1000 },
      );
    });

    it("displays short ID below identicon", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText("edw:a1b2c3d4")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("renders identicon SVG", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          const identiconContainer =
            screen.getByText("edw:a1b2c3d4").previousElementSibling;
          expect(identiconContainer?.innerHTML).toContain(
            "<svg>test identicon</svg>",
          );
        },
        { timeout: 1000 },
      );
    });

    it("displays petname as heading", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          const petnameElement = screen.getByText("Happy Elephant");
          expect(petnameElement).toHaveClass("text-2xl", "font-semibold");
        },
        { timeout: 1000 },
      );
    });

    it("shows export and import buttons", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(
            screen.getByText("Export Public Identity"),
          ).toBeInTheDocument();
          expect(
            screen.getByText("Import Identity (Coming Soon)"),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("disables import button", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          const importButton = screen
            .getByText("Import Identity (Coming Soon)")
            .closest("button");
          expect(importButton).toBeDisabled();
        },
        { timeout: 1000 },
      );
    });

    it("displays informational card about identity", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText(/About Your Identity:/)).toBeInTheDocument();
          expect(
            screen.getByText(/BRC-42 and BRC-103 standards/),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Wrapper Integration", () => {
    it("calls getIdentity on mount", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(cryptoDomain.getIdentity).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    it("displays identity after successful load", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText(mockPublicKey)).toBeInTheDocument();
          expect(screen.getByText("Happy Elephant")).toBeInTheDocument();
          expect(screen.getByText("edw:a1b2c3d4")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Identity Display", () => {
    it("formats public key correctly", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          const pubkey = screen.getByText(mockPublicKey);
          expect(pubkey.textContent).toBe(mockPublicKey);
          expect(pubkey).toHaveClass("break-all");
        },
        { timeout: 1000 },
      );
    });

    it("shows petname description text", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(
            screen.getByText(
              "Deterministically generated from your public key",
            ),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("shows public key description text", async () => {
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Compressed secp256k1 public key/),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Export Functionality", () => {
    let createElementSpy: ReturnType<typeof vi.spyOn> | null = null;
    let appendChildSpy: ReturnType<typeof vi.spyOn> | null = null;
    let removeChildSpy: ReturnType<typeof vi.spyOn> | null = null;
    let originalBlob: typeof Blob;

    beforeEach(() => {
      originalBlob = global.Blob;
    });

    afterEach(() => {
      createElementSpy?.mockRestore();
      appendChildSpy?.mockRestore();
      removeChildSpy?.mockRestore();
      createElementSpy = null;
      appendChildSpy = null;
      removeChildSpy = null;
      global.Blob = originalBlob;
      vi.useRealTimers();
    });

    function setupDownloadMocks() {
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      const origCreate = document.createElement.bind(document);
      createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag: string) =>
          tag === "a" ? (mockLink as unknown as HTMLElement) : origCreate(tag),
        );
      appendChildSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation(() => mockLink as unknown as Node);
      removeChildSpy = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation(() => mockLink as unknown as Node);
      global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();
      return mockLink;
    }

    it("exports identity as JSON file", async () => {
      render(<IdentitySettings />);
      await waitFor(() => screen.getByText("Export Public Identity"), {
        timeout: 1000,
      });

      const mockLink = setupDownloadMocks();

      const exportButton = screen.getByRole("button", { name: "Export" });
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(mockLink.click).toHaveBeenCalled();
          expect(mockLink.download).toBe("edwinpai-identity-edw:a1b2c3d4.json");
        },
        { timeout: 1000 },
      );
    });

    it("shows success message after export", async () => {
      render(<IdentitySettings />);
      await waitFor(() => screen.getByText("Export Public Identity"), {
        timeout: 1000,
      });

      setupDownloadMocks();

      const exportButton = screen.getByRole("button", { name: "Export" });
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Identity exported successfully/i),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("clears success message after 3 seconds", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<IdentitySettings />);

      await waitFor(() => screen.getByText("Export Public Identity"), {
        timeout: 2000,
      });

      setupDownloadMocks();

      const exportButton = screen.getByRole("button", { name: "Export" });
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Identity exported successfully/i),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      await vi.runAllTimersAsync();

      await waitFor(
        () => {
          expect(
            screen.queryByText(/Identity exported successfully/i),
          ).not.toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it("includes all identity fields in export", async () => {
      render(<IdentitySettings />);
      await waitFor(() => screen.getByText("Export Public Identity"), {
        timeout: 1000,
      });

      setupDownloadMocks();

      let blobContent = "";
      const BlobSpy = vi.spyOn(global, "Blob").mockImplementation(function (
        this: Blob,
        content?: BlobPart[],
      ) {
        if (content && content[0]) {
          blobContent = content[0] as string;
        }
        return { type: "application/json", size: 0 } as Blob;
      });

      const exportButton = screen.getByRole("button", { name: "Export" });
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(blobContent).not.toBe("");
          const exportData = JSON.parse(blobContent);
          expect(exportData).toMatchObject({
            publicKey: mockPublicKey,
            petname: "Happy Elephant",
            shortId: "edw:a1b2c3d4",
          });
          expect(exportData.exportedAt).toBeDefined();
        },
        { timeout: 1000 },
      );

      BlobSpy.mockRestore();
    });
  });

  describe("Copy Functionality", () => {
    function findCopyButton(): HTMLElement | null {
      const codeEl = document.querySelector("code");
      if (!codeEl) return null;
      const container = codeEl.parentElement;
      const button = container?.querySelector("button");
      return button || null;
    }

    it("copies public key to clipboard", async () => {
      const writeTextSpy = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue();
      render(<IdentitySettings />);

      await waitFor(() => screen.getByText(mockPublicKey), { timeout: 1000 });

      const copyButton = findCopyButton();
      expect(copyButton).not.toBeNull();

      fireEvent.click(copyButton!);

      await waitFor(
        () => {
          expect(writeTextSpy).toHaveBeenCalledWith(mockPublicKey);
        },
        { timeout: 1000 },
      );
    });

    it("handles clipboard API errors gracefully", async () => {
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
        new Error("Clipboard error"),
      );
      render(<IdentitySettings />);

      await waitFor(() => screen.getByText(mockPublicKey), { timeout: 1000 });

      const copyButton = findCopyButton();
      expect(copyButton).not.toBeNull();

      fireEvent.click(copyButton!);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Failed to copy public key/),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Error Handling", () => {
    it("displays error when getIdentity fails", async () => {
      vi.mocked(cryptoDomain.getIdentity).mockRejectedValue(
        new Error("Keypair not found"),
      );
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText(/Keypair not found/)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("displays generic error message for unknown errors", async () => {
      vi.mocked(cryptoDomain.getIdentity).mockRejectedValue("Unknown error");
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(
            screen.getByText(
              /Failed to load identity. Make sure you have a BSV keypair configured./,
            ),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("displays error icon in error state", async () => {
      vi.mocked(cryptoDomain.getIdentity).mockRejectedValue(
        new Error("Test error"),
      );
      render(<IdentitySettings />);

      await waitFor(
        () => {
          expect(screen.getByText(/Test error/)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      const errorText = screen.getByText(/Test error/);
      const flexContainer = errorText.closest(".flex.items-start");
      const errorIcon = flexContainer?.querySelector("svg");
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe("UI State Management", () => {
    it("does not call export when identity is null", async () => {
      const user = userEvent.setup();
      vi.mocked(cryptoDomain.getIdentity).mockRejectedValue(
        new Error("No identity"),
      );
      render(<IdentitySettings />);

      await waitFor(() => screen.getByText(/No identity/), { timeout: 1000 });

      expect(
        screen.queryByText("Export Public Identity"),
      ).not.toBeInTheDocument();
      expect(user).toBeDefined();
    });

    it("disables copy button behavior when identity is null", async () => {
      vi.mocked(cryptoDomain.getIdentity).mockRejectedValue(
        new Error("No identity"),
      );
      render(<IdentitySettings />);

      await waitFor(() => screen.getByText(/No identity/), { timeout: 1000 });

      const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

      const copyButtons = screen.queryAllByRole("button").filter((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.querySelector('rect[x="9"]');
      });

      expect(copyButtons.length).toBe(0);
      expect(writeTextSpy).not.toHaveBeenCalled();
    });
  });
});
