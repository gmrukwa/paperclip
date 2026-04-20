import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execute } from "../adapters/process/execute.js";

type CapturePayload = {
  agentId: string | null;
  companyId: string | null;
  apiUrl: string | null;
  taskId: string | null;
  wakePayloadJson: string | null;
};

describe("process adapter execute", () => {
  it("injects issue wake task id and structured wake payload into env", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-process-execute-wake-"));
    const capturePath = path.join(root, "capture.json");

    try {
      const result = await execute({
        runId: "run-process-wake",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Process Agent",
          adapterType: "process",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: process.execPath,
          args: [
            "-e",
            [
              "const fs = require('fs');",
              "const payload = {",
              "  agentId: process.env.PAPERCLIP_AGENT_ID || null,",
              "  companyId: process.env.PAPERCLIP_COMPANY_ID || null,",
              "  apiUrl: process.env.PAPERCLIP_API_URL || null,",
              "  taskId: process.env.PAPERCLIP_TASK_ID || null,",
              "  wakePayloadJson: process.env.PAPERCLIP_WAKE_PAYLOAD_JSON || null,",
              "};",
              "fs.writeFileSync(process.env.PAPERCLIP_TEST_CAPTURE_PATH, JSON.stringify(payload), 'utf8');",
            ].join("\n"),
          ],
          cwd: root,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          },
        },
        context: {
          issueId: "issue-1",
          paperclipWake: {
            reason: "issue_commented",
            issue: {
              id: "issue-1",
              identifier: "PAP-123",
              title: "Wire process wake context",
              status: "todo",
              priority: "medium",
            },
            commentIds: ["comment-1"],
            latestCommentId: "comment-1",
            comments: [
              {
                id: "comment-1",
                issueId: "issue-1",
                body: "Please handle this.",
                bodyTruncated: false,
                createdAt: "2026-04-20T10:00:00.000Z",
                author: { type: "user", id: "user-1" },
              },
            ],
            commentWindow: {
              requestedCount: 1,
              includedCount: 1,
              missingCount: 0,
            },
            truncated: false,
            fallbackFetchNeeded: false,
          },
        },
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeUndefined();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.agentId).toBe("agent-1");
      expect(capture.companyId).toBe("company-1");
      expect(capture.apiUrl).toMatch(/^http:\/\//);
      expect(capture.taskId).toBe("issue-1");
      expect(capture.wakePayloadJson).not.toBeNull();
      expect(JSON.parse(capture.wakePayloadJson ?? "{}")).toMatchObject({
        reason: "issue_commented",
        latestCommentId: "comment-1",
        commentIds: ["comment-1"],
        issue: {
          id: "issue-1",
          identifier: "PAP-123",
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
