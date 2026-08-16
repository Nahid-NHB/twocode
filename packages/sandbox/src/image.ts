import { resolve } from "path";

const IMAGE_TAG = "twocode-sandbox";
const PACKAGE_DIR = resolve(import.meta.dir, "..");

let buildPromise: Promise<void> | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  const proc = Bun.spawn(["docker", "info"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
  return proc.exitCode === 0;
}

export function ensureImage(): Promise<void> {
  if (buildPromise) return buildPromise;
  // Non-async function so concurrent callers receive the *same* promise
  // reference (not a freshly wrapped one). The runtime caches the in-flight
  // build by identity, which the test verifies with Object.is.
  buildPromise = _buildIfNeeded().catch((err) => {
    buildPromise = null;
    throw err;
  });
  return buildPromise;
}

async function _buildIfNeeded(): Promise<void> {
  const check = Bun.spawn(["docker", "images", IMAGE_TAG, "-q"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = await new Response(check.stdout).text();
  await check.exited;
  if (output.trim()) return;

  const build = Bun.spawn(
    ["docker", "buildx", "build", "-t", IMAGE_TAG, "."],
    { cwd: PACKAGE_DIR, stdout: "ignore", stderr: "pipe" },
  );
  const stderr = await new Response(build.stderr).text();
  await build.exited;
  if (build.exitCode !== 0) {
    throw new Error(`Failed to build sandbox image:\n${stderr}`);
  }
}

export async function reapOrphans(): Promise<void> {
  const list = Bun.spawn(
    ["docker", "ps", "-a", "--filter", "name=twocode-", "-q"],
    { stdout: "pipe", stderr: "ignore" },
  );
  const output = await new Response(list.stdout).text();
  await list.exited;

  const ids = output.split("\n").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const rm = Bun.spawn(["docker", "rm", "-f", ...ids], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await rm.exited;
}
