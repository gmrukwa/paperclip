import { describe, expect, it } from "vitest";
import { buildCodexExecArgs } from "./codex-args.js";

describe("buildCodexExecArgs", () => {
  it("enables Codex fast mode overrides for GPT-5.4", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.4",
      search: true,
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(true);
    expect(result.fastModeIgnoredReason).toBeNull();
    expect(result.args).toEqual([
      "--search",
      "exec",
      "--json",
      "--model",
      "gpt-5.4",
      "-c",
      'service_tier="fast"',
      "-c",
      "features.fast_mode=true",
      "-c",
      'shell_environment_policy.inherit="core"',
      "-c",
      "shell_environment_policy.ignore_default_excludes=true",
      "-c",
      'shell_environment_policy.include_only=["PAPERCLIP_*","AGENT_HOME","PWD","CODEX_HOME","HOME","PATH"]',
      "-",
    ]);
  });

  it("ignores fast mode for unsupported models", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.3-codex",
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(false);
    expect(result.fastModeIgnoredReason).toContain("currently only supported on gpt-5.4");
    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.3-codex",
      "-c",
      'shell_environment_policy.inherit="core"',
      "-c",
      "shell_environment_policy.ignore_default_excludes=true",
      "-c",
      'shell_environment_policy.include_only=["PAPERCLIP_*","AGENT_HOME","PWD","CODEX_HOME","HOME","PATH"]',
      "-",
    ]);
  });

  it("injects a forced shell environment policy after custom extra args", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.4",
      extraArgs: [
        "--sandbox",
        "workspace-write",
        "-c",
        'shell_environment_policy.inherit="all"',
      ],
    });

    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.4",
      "--sandbox",
      "workspace-write",
      "-c",
      'shell_environment_policy.inherit="all"',
      "-c",
      'shell_environment_policy.inherit="core"',
      "-c",
      "shell_environment_policy.ignore_default_excludes=true",
      "-c",
      'shell_environment_policy.include_only=["PAPERCLIP_*","AGENT_HOME","PWD","CODEX_HOME","HOME","PATH"]',
      "-",
    ]);
  });

  it("keeps the forced shell environment policy when resuming a session", () => {
    const result = buildCodexExecArgs(
      {
        model: "gpt-5.4",
      },
      {
        resumeSessionId: "codex-session-123",
      },
    );

    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.4",
      "-c",
      'shell_environment_policy.inherit="core"',
      "-c",
      "shell_environment_policy.ignore_default_excludes=true",
      "-c",
      'shell_environment_policy.include_only=["PAPERCLIP_*","AGENT_HOME","PWD","CODEX_HOME","HOME","PATH"]',
      "resume",
      "codex-session-123",
      "-",
    ]);
  });
});
