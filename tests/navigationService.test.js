import test from "node:test";
import assert from "node:assert/strict";

import { openHistoryResult } from "../src/search-page/services/navigationService.js";

test("openHistoryResult opens a new tab for Shift+Enter path", async () => {
  const calls = [];

  globalThis.chrome = {
    tabs: {
      create: async (payload) => {
        calls.push(["create", payload]);
      },
      getCurrent: async () => {
        throw new Error("getCurrent should not be called");
      },
      query: async () => {
        throw new Error("query should not be called");
      },
      update: async () => {
        throw new Error("update should not be called");
      }
    }
  };

  await openHistoryResult("https://example.com", { openInNewTab: true });

  assert.deepEqual(calls, [["create", { url: "https://example.com" }]]);
});

test("openHistoryResult updates the current extension tab for Enter path", async () => {
  const calls = [];

  globalThis.chrome = {
    tabs: {
      create: async () => {
        throw new Error("create should not be called");
      },
      getCurrent: async () => ({ id: 42 }),
      query: async () => {
        throw new Error("query should not be called");
      },
      update: async (tabId, payload) => {
        calls.push(["update", tabId, payload]);
      }
    }
  };

  await openHistoryResult("https://example.com", { openInNewTab: false });

  assert.deepEqual(calls, [["update", 42, { url: "https://example.com" }]]);
});

test("openHistoryResult falls back to the active browser tab when current tab is unavailable", async () => {
  const calls = [];

  globalThis.chrome = {
    tabs: {
      create: async () => {
        throw new Error("create should not be called");
      },
      getCurrent: async () => null,
      query: async () => [{ id: 7 }],
      update: async (tabId, payload) => {
        calls.push(["update", tabId, payload]);
      }
    }
  };

  await openHistoryResult("https://example.com", { openInNewTab: false });

  assert.deepEqual(calls, [["update", 7, { url: "https://example.com" }]]);
});
