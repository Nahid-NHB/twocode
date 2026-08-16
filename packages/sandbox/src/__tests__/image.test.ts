import { describe, test, expect } from "bun:test";
import { isDockerAvailable, ensureImage, reapOrphans } from "../image";

describe("isDockerAvailable", () => {
  test("returns true when Docker is running", async () => {
    const available = await isDockerAvailable();
    expect(available).toBe(true);
  });
});

describe("ensureImage", () => {
  test("builds or confirms twocode-sandbox image exists", async () => {
    await ensureImage();
    const check = Bun.spawn(["docker", "images", "twocode-sandbox", "-q"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(check.stdout).text();
    await check.exited;
    expect(output.trim()).not.toBe("");
  });

  test("second call resolves immediately (idempotent)", async () => {
    await ensureImage(); // warm the cache
    const t0 = Date.now();
    await ensureImage();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(100);
  });

  test("concurrent calls share the same in-flight promise", () => {
    const p1 = ensureImage();
    const p2 = ensureImage();
    // Bun's expect().toBe() stringifies promises instead of comparing
    // identity, so use Object.is directly to verify the in-flight cache.
    expect(Object.is(p1, p2)).toBe(true);
    return Promise.all([p1, p2]);
  });
});

describe("reapOrphans", () => {
  test("removes leftover twocode-* containers", async () => {
    await ensureImage();
    const create = Bun.spawn(
      [
        "docker", "run", "-d",
        "--name", "twocode-orphan-test",
        "twocode-sandbox",
        "sleep", "60",
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    await create.exited;

    await reapOrphans();

    const check = Bun.spawn(
      ["docker", "ps", "-a", "--filter", "name=twocode-orphan-test", "-q"],
      { stdout: "pipe", stderr: "ignore" },
    );
    const output = await new Response(check.stdout).text();
    await check.exited;
    expect(output.trim()).toBe("");
  });

  test("no-ops when nothing matches", async () => {
    await expect(reapOrphans()).resolves.toBeUndefined();
  });
});
