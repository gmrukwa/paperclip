import { describe, expect, it } from "vitest";
import {
  appendStructuredJsonSection,
  buildWakeText,
  resolveSessionKey,
} from "./execute.js";

describe("resolveSessionKey", () => {
  it("prefixes run-scoped session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "run",
        configuredSessionKey: null,
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip:run:run-123");
  });

  it("prefixes issue-scoped session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "issue",
        configuredSessionKey: null,
        agentId: "meridian",
        runId: "run-123",
        issueId: "issue-456",
      }),
    ).toBe("agent:meridian:paperclip:issue:issue-456");
  });

  it("prefixes fixed session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "fixed",
        configuredSessionKey: "paperclip",
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip");
  });

  it("does not double-prefix an already-routed session key", () => {
    expect(
      resolveSessionKey({
        strategy: "fixed",
        configuredSessionKey: "agent:meridian:paperclip",
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip");
  });
});

describe("appendStructuredJsonSection", () => {
  it("appends structured Paperclip context into message text", () => {
    const result = appendStructuredJsonSection(
      "base wake text",
      "Paperclip runtime context JSON:",
      {
        runId: "run-123",
        issueId: "issue-456",
      },
    );

    expect(result).toContain("base wake text");
    expect(result).toContain("Paperclip runtime context JSON:");
    expect(result).toContain('"runId": "run-123"');
    expect(result).toContain('"issueId": "issue-456"');
  });

  it("does not append anything for empty payload", () => {
    const result = appendStructuredJsonSection(
      "base wake text",
      "Paperclip runtime context JSON:",
      {},
    );

    expect(result).toBe("base wake text");
  });
});

describe("buildWakeText", () => {
  it("does not instruct the agent to load PAPERCLIP_API_KEY from a hardcoded file", () => {
    const text = buildWakeText(
      {
        runId: "run-123",
        agentId: "meridian",
        companyId: "company-123",
        taskId: "task-123",
        issueId: "issue-456",
        wakeReason: "comment",
        wakeCommentId: "comment-789",
        approvalId: null,
        approvalStatus: null,
        issueIds: ["issue-456"],
      },
      {
        PAPERCLIP_RUN_ID: "run-123",
        PAPERCLIP_AGENT_ID: "meridian",
        PAPERCLIP_COMPANY_ID: "company-123",
        PAPERCLIP_API_URL: "https://paperclip.example.com",
      },
      "",
    );

    expect(text).toContain("Use the existing PAPERCLIP_API_KEY from the runtime environment.");
    expect(text).toContain("Do not fetch PAPERCLIP_API_KEY from any filesystem path");
    expect(text).toContain("If PAPERCLIP_API_KEY is missing from the runtime, stop and report a missing environment variable instead of guessing.");
    expect(text).not.toContain("paperclip-claimed-api-key.json");
    expect(text).not.toContain("Load PAPERCLIP_API_KEY from");
    expect(text).not.toContain("~/.openclaw/workspace");
  });
});
