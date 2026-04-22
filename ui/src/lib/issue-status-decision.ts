import type { Issue } from "@paperclipai/shared";

export type IssueStatusDecisionPrompt = {
  outcome: "approved" | "changes_requested";
  title: string;
  description: string;
  submitLabel: string;
};

type IssueStatusDecisionInput = Pick<Issue, "status" | "executionPolicy" | "executionState">;

function currentUserIsStageParticipant(issue: IssueStatusDecisionInput, currentUserId: string | null | undefined) {
  if (!currentUserId) return false;
  const participant = issue.executionState?.currentParticipant;
  return participant?.type === "user" && participant.userId === currentUserId;
}

export function getIssueStatusDecisionPrompt(
  issue: IssueStatusDecisionInput,
  requestedStatus: string,
  currentUserId: string | null | undefined,
): IssueStatusDecisionPrompt | null {
  if (requestedStatus === issue.status) return null;
  if (!issue.executionPolicy || issue.executionState?.status !== "pending") return null;
  if (!currentUserIsStageParticipant(issue, currentUserId)) return null;

  const stageType = issue.executionState.currentStageType === "approval" ? "approval" : "review";
  const stageLabel = stageType === "approval" ? "approval" : "review";

  if (requestedStatus === "done") {
    return {
      outcome: "approved",
      title: `Approve ${stageLabel}`,
      description: `Add the required ${stageLabel} comment before marking this issue done.`,
      submitLabel: "Approve and mark done",
    };
  }

  if (requestedStatus !== "in_review") {
    return {
      outcome: "changes_requested",
      title: `Request ${stageLabel} changes`,
      description: `Add the required ${stageLabel} comment before returning this issue for changes.`,
      submitLabel: "Request changes",
    };
  }

  return null;
}
