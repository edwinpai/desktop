import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_HISTORY_STORAGE_PREFIX,
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from "./chat-history";

beforeEach(() => {
  window.localStorage.clear();
});

describe("chat history persistence", () => {
  it("saves and loads chat history per session", () => {
    saveChatHistory("agent:main:main", [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);

    expect(loadChatHistory("agent:main:main")).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    expect(loadChatHistory("agent:other:main")).toEqual([]);
  });

  it("filters corrupt entries and ignores corrupt JSON", () => {
    window.localStorage.setItem(
      `${CHAT_HISTORY_STORAGE_PREFIX}agent:main:main`,
      JSON.stringify([
        { role: "user", content: "valid" },
        { role: "alien", content: "bad" },
        { role: "assistant", content: 42 },
      ]),
    );
    expect(loadChatHistory("agent:main:main")).toEqual([
      { role: "user", content: "valid" },
    ]);

    window.localStorage.setItem(
      `${CHAT_HISTORY_STORAGE_PREFIX}agent:main:main`,
      "not json",
    );
    expect(loadChatHistory("agent:main:main")).toEqual([]);
  });

  it("clears history", () => {
    saveChatHistory("agent:main:main", [{ role: "system", content: "note" }]);
    clearChatHistory("agent:main:main");
    expect(loadChatHistory("agent:main:main")).toEqual([]);
  });
});
