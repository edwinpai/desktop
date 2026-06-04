import { invoke } from "@tauri-apps/api/core";
import { callGatewayMethod, type GatewayTarget } from "@/lib/gateway-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildKnowledgeDiscipline,
  createKnowledgeDiscipline,
  deleteKnowledgeDiscipline,
  getKnowledgeDisciplineDetails,
  listKnowledgeDisciplines,
  updateKnowledgeDiscipline,
} from "@/lib/knowledge";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/gateway-context", () => ({
  buildGatewayTarget: vi.fn((config) => ({
    url: config.gatewayUrl ?? "http://localhost:18789",
    token: config.gatewayToken,
    kind: "local",
  })),
  callGatewayMethod: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const callGatewayMethodMock = vi.mocked(callGatewayMethod);
const target: GatewayTarget = { url: "http://localhost:18789", kind: "local" };

describe("knowledge discipline wrappers", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    callGatewayMethodMock.mockReset();
  });

  it("falls back to Tauri command names when no gateway target is provided", async () => {
    invokeMock
      .mockResolvedValueOnce({
        storagePath: "/tmp/disciplines.json",
        disciplines: [],
      })
      .mockResolvedValueOnce({
        discipline: {
          id: "discipline-build-smoke",
          name: "Discipline Build Smoke",
          selectedCollections: ["workspace"],
          status: "draft",
          artifactKinds: [],
        },
        artifactPaths: [],
      })
      .mockResolvedValueOnce({ id: "new-discipline" })
      .mockResolvedValueOnce({ id: "new-discipline" })
      .mockResolvedValueOnce({ stdout: "built", stderr: "" })
      .mockResolvedValueOnce({
        id: "new-discipline",
        trashedPath: "/tmp/trash",
      });

    await listKnowledgeDisciplines();
    await getKnowledgeDisciplineDetails("discipline-build-smoke");
    await createKnowledgeDiscipline({ name: "New Discipline" });
    await updateKnowledgeDiscipline({ id: "new-discipline", name: "Renamed" });
    await buildKnowledgeDiscipline("new-discipline");
    await deleteKnowledgeDiscipline("new-discipline");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "knowledge_list_disciplines");
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      "knowledge_get_discipline_details",
      {
        id: "discipline-build-smoke",
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      3,
      "knowledge_create_discipline",
      {
        input: { name: "New Discipline" },
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      4,
      "knowledge_update_discipline",
      {
        input: { id: "new-discipline", name: "Renamed" },
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      5,
      "knowledge_build_discipline",
      {
        id: "new-discipline",
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      6,
      "knowledge_delete_discipline",
      {
        id: "new-discipline",
      },
    );
  });

  it("routes management actions through gateway RPC when a target is provided", async () => {
    callGatewayMethodMock
      .mockResolvedValueOnce({
        registryPath: "/tmp/disciplines.json",
        disciplines: [{ id: "edwin-development", name: "Edwin Development" }],
        issues: [
          {
            level: "warning",
            disciplineId: "edwin-development",
            message: "Heads up",
          },
        ],
      })
      .mockResolvedValueOnce({
        discipline: {
          id: "edwin-development",
          name: "Edwin Development",
          selectedCollections: ["discipline-edwin-development-source"],
          artifactPaths: ["/tmp/overview.md"],
        },
      })
      .mockResolvedValueOnce({
        discipline: { id: "new-discipline" },
        path: "/tmp/NewDiscipline",
      })
      .mockResolvedValueOnce({ discipline: { id: "new-discipline" } })
      .mockResolvedValueOnce({
        issues: [
          {
            level: "error",
            disciplineId: "new-discipline",
            message: "Missing collection",
          },
        ],
      })
      .mockResolvedValueOnce({
        deleted: "new-discipline",
        trashedPath: "/tmp/trash",
      });

    const listed = await listKnowledgeDisciplines(target);
    await getKnowledgeDisciplineDetails("edwin-development", target);
    await createKnowledgeDiscipline({ name: "New Discipline" }, target);
    await updateKnowledgeDiscipline(
      { id: "new-discipline", name: "Renamed" },
      target,
    );
    const build = await buildKnowledgeDiscipline("new-discipline", target);
    await deleteKnowledgeDiscipline("new-discipline", target);

    expect(listed.issues).toEqual([
      {
        level: "warning",
        disciplineId: "edwin-development",
        message: "Heads up",
        path: undefined,
      },
    ]);
    expect(build.issues).toEqual([
      {
        level: "error",
        disciplineId: "new-discipline",
        message: "Missing collection",
        path: undefined,
      },
    ]);

    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      1,
      target,
      "knowledge.disciplines.list",
      {},
      15000,
      "Timed out listing disciplines",
    );
    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      2,
      target,
      "knowledge.disciplines.get",
      { id: "edwin-development" },
      15000,
      "Timed out loading discipline details",
    );
    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      3,
      target,
      "knowledge.disciplines.create",
      expect.objectContaining({ id: "new-discipline", name: "New Discipline" }),
      30000,
      "Timed out creating discipline",
    );
    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      4,
      target,
      "knowledge.disciplines.update",
      { id: "new-discipline", name: "Renamed" },
      30000,
      "Timed out updating discipline",
    );
    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      5,
      target,
      "knowledge.disciplines.build",
      { id: "new-discipline" },
      60000,
      "Timed out building discipline",
    );
    expect(callGatewayMethodMock).toHaveBeenNthCalledWith(
      6,
      target,
      "knowledge.disciplines.delete",
      { id: "new-discipline" },
      30000,
      "Timed out deleting discipline",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
