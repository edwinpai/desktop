import { describe, it, expect } from "vitest";
import { normalizeMessageContent } from "@/lib/messageContent";

describe("normalizeMessageContent", () => {
  it("passes strings through unchanged", () => {
    expect(normalizeMessageContent("hello")).toBe("hello");
    expect(normalizeMessageContent("")).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeMessageContent(null)).toBe("");
    expect(normalizeMessageContent(undefined)).toBe("");
  });

  it("joins multimodal content block arrays by text part", () => {
    const parts = [
      { type: "text", text: "first " },
      { type: "image", imageUrl: "data:image/png;base64,..." },
      { type: "text", text: "second" },
    ];
    expect(normalizeMessageContent(parts)).toBe("first second");
  });

  it("handles array of plain strings", () => {
    expect(normalizeMessageContent(["a", "b", "c"])).toBe("abc");
  });

  it("falls back to .text on a bare object", () => {
    expect(normalizeMessageContent({ text: "hi", type: "text" })).toBe("hi");
  });

  it("stringifies arbitrary objects rather than crashing", () => {
    const out = normalizeMessageContent({ foo: 1 });
    expect(out).toContain("foo");
  });
});
