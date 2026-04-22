import { describe, expect, it } from "vitest";
import type { Issue } from "@paperclipai/shared";
import { getIssueStatusDecisionPrompt } from "./issue-status-decision";

function issue(overrides: Partial<Pick<Issue, "status" | "executionPolicy" | "executionState">> = {}) {
  return {
    status: "in_review",
    executionPolicy: {
      mode: "normal",
      commentRequired: true,
      stages: [
        {
          id: "stage-1",
          type: "review",
          approvalsNeeded: 1,
          participants: [{ id: "participant-1", type: "user", userId: "user-1", agentId: null }],
        },
      ],
    },
    executionState: {
      status: "pending",
      currentStageId: "stage-1",
      currentStageIndex: 0,
      currentStageType: "review",
      currentParticipant: { type: "user", userId: "user-1", agentId: null },
      returnAssignee: { type: "agent", agentId: "agent-1", userId: null },
      completedStageIds: [],
      lastDecisionId: null,
      lastDecisionOutcome: null,
    },
    ...overrides,
  } as Pick<Issue, "status" | "executionPolicy" | "executionState">;
}

describe("issue status decision prompts", () => {
  it("requires a decision comment when the current user approves a pending review", () => {
    expect(getIssueStatusDecisionPrompt(issue(), "done", "user-1")).toMatchObject({
      outcome: "approved",
      submitLabel: "Approve and mark done",
    });
  });

  it("requires a decision comment when the current user requests changes", () => {
    expect(getIssueStatusDecisionPrompt(issue(), "in_progress", "user-1")).toMatchObject({
      outcome: "changes_requested",
      submitLabel: "Request changes",
    });
  });

  it("does not prompt when another user is the current participant", () => {
    expect(getIssueStatusDecisionPrompt(issue(), "done", "user-2")).toBeNull();
  });

  it("does not prompt for non execution-policy status changes", () => {
    expect(getIssueStatusDecisionPrompt(issue({ executionPolicy: null, executionState: null }), "done", "user-1")).toBeNull();
  });
});
