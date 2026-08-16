import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runInSandbox } from "../index";

const cwd = mkdtempSync(join(tmpdir(), "twocode-sandbox-test-"));

afterAll(() => rmSync(cwd, { recursive: true, force: true }));

describe("runInSandbox", () => {
  test("runs command and returns stdout", async () => {
    const result = await runInSandbox("echo hello", cwd);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  test("captures stderr separately", async () => {
    const result = await runInSandbox("echo oops >&2", cwd);
    expect(result.stderr.trim()).toBe("oops");
    expect(result.exitCode).toBe(0);
  });

  test("returns non-zero exit code on failure", async () => {
    const result = await runInSandbox("exit 42", cwd);
    expect(result.exitCode).toBe(42);
  });

  test("blocks network access", async () => {
    const result = await runInSandbox(
      "curl -s --max-time 5 https://example.com",
      cwd,
    );
    expect(result.exitCode).not.toBe(0);
  });

  test("cannot read host home directory", async () => {
    const result = await runInSandbox("ls /home 2>&1; ls /root 2>&1", cwd);
    const combined = result.stdout + result.stderr;
    expect(combined).not.toMatch(/nahid/);
  });

  test("project directory is writable", async () => {
    const result = await runInSandbox("echo sandbox > testfile.txt", cwd);
    expect(result.exitCode).toBe(0);
    const content = readFileSync(join(cwd, "testfile.txt"), "utf-8");
    expect(content.trim()).toBe("sandbox");
  });

  test("/tmp is writable", async () => {
    const result = await runInSandbox("touch /tmp/x && echo ok", cwd);
    expect(result.stdout.trim()).toBe("ok");
    expect(result.exitCode).toBe(0);
  });

  test("files created in sandbox are host-owned, not root", async () => {
    const result = await runInSandbox("touch owned.txt", cwd);
    expect(result.exitCode).toBe(0);
    const stats = statSync(join(cwd, "owned.txt"));
    if (typeof process.getuid === "function") {
      expect(stats.uid).toBe(process.getuid());
      expect(stats.uid).not.toBe(0);
    }
  });

  test("times out and returns exitCode 124", async () => {
    const start = Date.now();
    const result = await runInSandbox("sleep 60", cwd);
    const elapsed = Date.now() - start;
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timed out");
    expect(elapsed).toBeLessThan(35_000);
  }, 40_000);
});
