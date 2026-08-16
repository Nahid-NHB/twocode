import { describe, test, expect } from "bun:test";
import { executeLocalTool } from "../../lib/local-tools";
import { Mode } from "@twocode/shared";

describe("executeLocalTool bash via sandbox", () => {
  test("runs bash command through Docker sandbox", async () => {
    const result = await executeLocalTool(
      "bash",
      { command: "echo integrated" },
      Mode.BUILD,
    );
    expect((result as { stdout: string; exitCode: number }).stdout.trim()).toBe(
      "integrated",
    );
    expect((result as { exitCode: number }).exitCode).toBe(0);
  });

  test("bash command runs inside the sandbox container (hostname starts with twocode-)", async () => {
    const result = await executeLocalTool(
      "bash",
      { command: "hostname" },
      Mode.BUILD,
    );
    expect((result as { stdout: string }).stdout.trim()).toMatch(/^twocode-/);
  });

  test("bash is blocked in PLAN mode", async () => {
    await expect(
      executeLocalTool("bash", { command: "echo hi" }, Mode.PLAN),
    ).rejects.toThrow("not available in PLAN mode");
  });
});
