import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgePanel } from "./KnowledgePanel";

vi.mock("@/hooks/useConfig", () => ({
  useConfig: () => ({
    config: { gatewayUrl: "http://localhost:18789", gatewayToken: "token" },
    loading: false,
    error: null,
    update: vi.fn(),
    reset: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("@/components/skills/SkillsPanel", () => ({
  SkillsPanel: () => <div>Skills panel</div>,
}));

vi.mock("@/lib/knowledge", async () => {
  const actual = await vi.importActual<typeof import("@/lib/knowledge")>(
    "@/lib/knowledge",
  );
  return {
    ...actual,
    buildGatewayTarget: vi.fn(() => ({
      url: "http://localhost:18789",
      token: "token",
      kind: "local",
    })),
    listKnowledgeSources: vi.fn(),
    listKnowledgeDisciplines: vi.fn(),
    listKnowledgeRuns: vi.fn(),
  };
});

import {
  listKnowledgeDisciplines,
  listKnowledgeRuns,
  listKnowledgeSources,
} from "@/lib/knowledge";

const listKnowledgeSourcesMock = vi.mocked(listKnowledgeSources);
const listKnowledgeDisciplinesMock = vi.mocked(listKnowledgeDisciplines);
const listKnowledgeRunsMock = vi.mocked(listKnowledgeRuns);

describe("KnowledgePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listKnowledgeSourcesMock.mockResolvedValue({
      sourcesPath: "/tmp/sources.yaml",
      sources: [
        {
          id: "workspace",
          sourceType: "filesystem",
          label: "Workspace",
          origin: "/workspace",
          enabled: true,
        },
      ],
      collections: [{ name: "workspace", files: 3 }],
      qmdAvailable: true,
    });
    listKnowledgeDisciplinesMock.mockResolvedValue({
      storagePath: "/tmp/disciplines.json",
      disciplines: [
        {
          id: "edwin-development",
          name: "Edwin Development",
          selectedCollections: ["workspace"],
          status: "ready",
          artifactKinds: ["overview"],
        },
      ],
      issues: [],
    });
    listKnowledgeRunsMock.mockResolvedValue({
      historyPath: "/tmp/runs",
      runs: [
        {
          runId: "run-1",
          status: "succeeded",
          goal: "Index docs",
          manifestPath: "/tmp/runs/run-1/manifest.json",
        },
      ],
    });
  });

  it("loads sources, disciplines, and runs", async () => {
    render(<KnowledgePanel />);

    expect(screen.getByText("Loading knowledge state...")).toBeInTheDocument();
    expect(await screen.findByText("Workspace")).toBeInTheDocument();
    expect(listKnowledgeSourcesMock).toHaveBeenCalledTimes(1);
    expect(listKnowledgeDisciplinesMock).toHaveBeenCalledTimes(1);
    expect(listKnowledgeRunsMock).toHaveBeenCalledWith(20);
  });

  it("keeps the tab usable when one knowledge surface fails", async () => {
    listKnowledgeRunsMock.mockRejectedValueOnce(new Error("run history missing"));

    render(<KnowledgePanel />);

    await waitFor(() => {
      expect(screen.getByText("Workspace")).toBeInTheDocument();
    });
    expect(screen.getByText(/Runs: run history missing/)).toBeInTheDocument();
  });
});
