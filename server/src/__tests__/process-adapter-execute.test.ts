import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execute } from "../adapters/process/execute.js";

type CapturePayload = {
  agentId: string | null;
  companyId: string | null;
  apiUrl: string | null;
  apiKey: string | null;
  issueId: string | null;
  taskId: string | null;
  wakeReason: string | null;
  wakeCommentId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  linkedIssueIds: string | null;
  wakePayloadJson: string | null;
};

const ISSUE_ID = "issue-1";

function issueWakePayload(reason: string, extra: Record<string, unknown> = {}) {
  return {
    reason,
    issue: {
      id: ISSUE_ID,
      identifier: "PAP-123",
      title: "Wire process wake context",
      status: "todo",
      priority: "medium",
    },
    ...extra,
  };
}

function issueWakeContext(
  reason: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    issueId: ISSUE_ID,
    wakeReason: reason,
    paperclipWake: issueWakePayload(reason),
    ...extra,
  };
}

async function executeAndCapture(
  context: Record<string, unknown>,
  options: {
    authToken?: string;
    env?: Record<string, string>;
  } = {},
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-process-execute-wake-"));
  const capturePath = path.join(root, "capture.json");
  let invocationEnv: Record<string, string> | null = null;

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
            "  apiKey: process.env.PAPERCLIP_API_KEY || null,",
            "  issueId: process.env.PAPERCLIP_ISSUE_ID || null,",
            "  taskId: process.env.PAPERCLIP_TASK_ID || null,",
            "  wakeReason: process.env.PAPERCLIP_WAKE_REASON || null,",
            "  wakeCommentId: process.env.PAPERCLIP_WAKE_COMMENT_ID || null,",
            "  approvalId: process.env.PAPERCLIP_APPROVAL_ID || null,",
            "  approvalStatus: process.env.PAPERCLIP_APPROVAL_STATUS || null,",
            "  linkedIssueIds: process.env.PAPERCLIP_LINKED_ISSUE_IDS || null,",
            "  wakePayloadJson: process.env.PAPERCLIP_WAKE_PAYLOAD_JSON || null,",
            "};",
            "fs.writeFileSync(process.env.PAPERCLIP_TEST_CAPTURE_PATH, JSON.stringify(payload), 'utf8');",
          ].join("\n"),
        ],
        cwd: root,
        env: {
          PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          ...options.env,
        },
      },
      context,
      onLog: async () => {},
      onMeta: async (meta) => {
        invocationEnv = meta.env ?? null;
      },
      authToken: options.authToken,
    });

    const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
    return { result, capture, invocationEnv };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const issueWakeCases = [
  ["issue_assigned", issueWakeContext("issue_assigned")],
  ["issue_checked_out", issueWakeContext("issue_checked_out")],
  ["issue_status_changed", issueWakeContext("issue_status_changed")],
  ["issue_commented", issueWakeContext("issue_commented", {
    taskId: ISSUE_ID,
    commentId: "comment-1",
    wakeCommentId: "comment-1",
    paperclipWake: issueWakePayload("issue_commented", {
      commentIds: ["comment-1"],
      latestCommentId: "comment-1",
      comments: [
        {
          id: "comment-1",
          issueId: ISSUE_ID,
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
    }),
  })],
  ["issue_reopened_via_comment", issueWakeContext("issue_reopened_via_comment", {
    taskId: ISSUE_ID,
    commentId: "comment-2",
    wakeCommentId: "comment-2",
  })],
  ["issue_comment_mentioned", issueWakeContext("issue_comment_mentioned", {
    taskId: ISSUE_ID,
    commentId: "comment-3",
    wakeCommentId: "comment-3",
  })],
  ["execution_review_requested", issueWakeContext("execution_review_requested", {
    taskId: ISSUE_ID,
    executionStage: {
      wakeRole: "reviewer",
      stageId: "stage-review",
      stageType: "review",
      allowedActions: ["approve", "request_changes"],
    },
    paperclipWake: issueWakePayload("execution_review_requested", {
      executionStage: {
        wakeRole: "reviewer",
        stageId: "stage-review",
        stageType: "review",
        allowedActions: ["approve", "request_changes"],
      },
    }),
  })],
  ["execution_approval_requested", issueWakeContext("execution_approval_requested", {
    taskId: ISSUE_ID,
    executionStage: {
      wakeRole: "approver",
      stageId: "stage-approval",
      stageType: "approval",
      allowedActions: ["approve", "request_changes"],
    },
    paperclipWake: issueWakePayload("execution_approval_requested", {
      executionStage: {
        wakeRole: "approver",
        stageId: "stage-approval",
        stageType: "approval",
        allowedActions: ["approve", "request_changes"],
      },
    }),
  })],
  ["execution_changes_requested", issueWakeContext("execution_changes_requested", {
    taskId: ISSUE_ID,
    executionStage: {
      wakeRole: "executor",
      stageId: "stage-review",
      stageType: "review",
      allowedActions: ["address_changes", "resubmit"],
    },
    paperclipWake: issueWakePayload("execution_changes_requested", {
      executionStage: {
        wakeRole: "executor",
        stageId: "stage-review",
        stageType: "review",
        allowedActions: ["address_changes", "resubmit"],
      },
    }),
  })],
  ["approval_approved", issueWakeContext("approval_approved", {
    taskId: ISSUE_ID,
    approvalId: "approval-1",
    approvalStatus: "approved",
    issueIds: [ISSUE_ID, "issue-2"],
  })],
  ["issue_blockers_resolved", issueWakeContext("issue_blockers_resolved", {
    taskId: ISSUE_ID,
    resolvedBlockerIssueId: "issue-blocker",
    blockerIssueIds: ["issue-blocker"],
  })],
  ["issue_children_completed", issueWakeContext("issue_children_completed", {
    taskId: ISSUE_ID,
    completedChildIssueId: "issue-child",
    childIssueIds: ["issue-child"],
  })],
  ["missing_issue_comment", issueWakeContext("missing_issue_comment", {
    retryOfRunId: "run-original",
    retryReason: "missing_issue_comment",
    missingIssueCommentForRunId: "run-original",
  })],
  ["process_lost_retry", issueWakeContext("process_lost_retry", {
    retryOfRunId: "run-original",
    retryReason: "process_lost",
  })],
  ["issue_assignment_recovery", issueWakeContext("issue_assignment_recovery", {
    taskId: ISSUE_ID,
    retryReason: "assignment_recovery",
  })],
  ["issue_continuation_needed", issueWakeContext("issue_continuation_needed", {
    taskId: ISSUE_ID,
    retryReason: "issue_continuation_needed",
  })],
] as const;

describe("process adapter execute", () => {
  it("injects PAPERCLIP_API_KEY from authToken for non-issue heartbeat wakes", async () => {
    const { capture, invocationEnv } = await executeAndCapture({
      source: "scheduler",
      reason: "interval_elapsed",
      wakeReason: "heartbeat_timer",
    }, {
      authToken: "run-jwt-token",
    });

    expect(capture.apiKey).toBe("run-jwt-token");
    expect(invocationEnv?.PAPERCLIP_API_KEY).toBe("***REDACTED***");
  });

  it("injects PAPERCLIP_API_KEY from authToken for issue-scoped wakes", async () => {
    const { capture, invocationEnv } = await executeAndCapture(
      issueWakeContext("execution_approval_requested", {
        taskId: ISSUE_ID,
        executionStage: {
          wakeRole: "approver",
          stageId: "stage-approval",
          stageType: "approval",
          allowedActions: ["approve", "request_changes"],
        },
      }),
      {
        authToken: "issue-run-jwt-token",
      },
    );

    expect(capture.issueId).toBe(ISSUE_ID);
    expect(capture.taskId).toBe(ISSUE_ID);
    expect(capture.apiKey).toBe("issue-run-jwt-token");
    expect(invocationEnv?.PAPERCLIP_API_KEY).toBe("***REDACTED***");
  });

  it("does not override explicit PAPERCLIP_API_KEY from adapter env", async () => {
    const { capture } = await executeAndCapture({
      source: "scheduler",
      reason: "interval_elapsed",
      wakeReason: "heartbeat_timer",
    }, {
      authToken: "run-jwt-token",
      env: {
        PAPERCLIP_API_KEY: "configured-api-key",
      },
    });

    expect(capture.apiKey).toBe("configured-api-key");
  });

  it.each(issueWakeCases)("sets PAPERCLIP_ISSUE_ID for %s wake", async (reason, context) => {
    const { result, capture, invocationEnv } = await executeAndCapture(context);

    expect(result.exitCode).toBe(0);
    expect(result.errorMessage).toBeUndefined();
    expect(capture.agentId).toBe("agent-1");
    expect(capture.companyId).toBe("company-1");
    expect(capture.apiUrl).toMatch(/^http:\/\//);
    expect(capture.issueId).toBe(ISSUE_ID);
    expect(capture.taskId).toBe(ISSUE_ID);
    expect(capture.wakeReason).toBe(reason);
    expect(capture.wakePayloadJson).not.toBeNull();
    expect(JSON.parse(capture.wakePayloadJson ?? "{}")).toMatchObject({
      reason,
      issue: {
        id: ISSUE_ID,
        identifier: "PAP-123",
      },
    });
    expect(invocationEnv).toMatchObject({
      PAPERCLIP_ISSUE_ID: ISSUE_ID,
      PAPERCLIP_TASK_ID: ISSUE_ID,
      PAPERCLIP_WAKE_REASON: reason,
    });
  });

  it("sets comment wake env for comment-scoped issue wakes", async () => {
    const { capture } = await executeAndCapture(issueWakeContext("issue_commented", {
      taskId: ISSUE_ID,
      commentId: "comment-1",
      wakeCommentId: "comment-1",
      paperclipWake: issueWakePayload("issue_commented", {
        commentIds: ["comment-1"],
        latestCommentId: "comment-1",
        comments: [
          {
            id: "comment-1",
            issueId: ISSUE_ID,
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
      }),
    }));

    expect(capture.issueId).toBe(ISSUE_ID);
    expect(capture.wakeCommentId).toBe("comment-1");
    expect(JSON.parse(capture.wakePayloadJson ?? "{}")).toMatchObject({
      latestCommentId: "comment-1",
      commentIds: ["comment-1"],
    });
  });

  it("sets approval env for approval resolution wakes", async () => {
    const { capture } = await executeAndCapture(issueWakeContext("approval_approved", {
      approvalId: "approval-1",
      approvalStatus: "approved",
      issueIds: [ISSUE_ID, "issue-2"],
    }));

    expect(capture.issueId).toBe(ISSUE_ID);
    expect(capture.approvalId).toBe("approval-1");
    expect(capture.approvalStatus).toBe("approved");
    expect(capture.linkedIssueIds).toBe(`${ISSUE_ID},issue-2`);
  });

  it("falls back to structured wake payload issue id when context issue id is missing", async () => {
    const { capture } = await executeAndCapture({
      wakeReason: "approval_approved",
      paperclipWake: issueWakePayload("approval_approved"),
    });

    expect(capture.issueId).toBe(ISSUE_ID);
    expect(capture.taskId).toBe(ISSUE_ID);
  });

  it("falls back to the first linked issue id when no primary issue id is present", async () => {
    const { capture } = await executeAndCapture({
      wakeReason: "approval_approved",
      issueIds: ["issue-linked-1", "issue-linked-2"],
      approvalId: "approval-1",
      approvalStatus: "approved",
    });

    expect(capture.issueId).toBe("issue-linked-1");
    expect(capture.taskId).toBe("issue-linked-1");
    expect(capture.linkedIssueIds).toBe("issue-linked-1,issue-linked-2");
    expect(capture.wakePayloadJson).toBeNull();
  });

  it("does not invent issue env for non-issue timer wakes", async () => {
    const { capture } = await executeAndCapture({
      source: "scheduler",
      reason: "interval_elapsed",
      wakeReason: "heartbeat_timer",
    });

    expect(capture.issueId).toBeNull();
    expect(capture.taskId).toBeNull();
    expect(capture.wakeReason).toBe("heartbeat_timer");
    expect(capture.wakePayloadJson).toBeNull();
  });
});
