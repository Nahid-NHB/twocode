import { randomUUID } from "crypto";
import { ensureImage, isDockerAvailable } from "./image";

export { isDockerAvailable, reapOrphans } from "./image";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const MAX_OUTPUT = 20_000;
const TIMEOUT_MS = 30_000;

// Read once at module load, not per call. Undefined on platforms without
// getuid/getgid (e.g. Windows) — falls back to the image's baked-in UID 1000.
const HOST_UID = typeof process.getuid === "function" ? process.getuid() : undefined;
const HOST_GID = typeof process.getgid === "function" ? process.getgid() : undefined;

function truncate(value: string, limit: number): string {
  return value.length > limit
    ? `${value.slice(0, limit)}\n... (truncated, ${value.length} total chars)`
    : value;
}

export async function runInSandbox(
  command: string,
  cwd: string,
): Promise<SandboxResult> {
  const available = await isDockerAvailable();
  if (!available) {
    throw new Error("bash tool requires Docker. Start Docker and try again.");
  }

  await ensureImage();

  const name = `twocode-${randomUUID().slice(0, 8)}`;

  const args = [
    "docker", "run",
    "--rm",
    "--name", name,
    "--network=none",
    "--cap-drop=ALL",
    "--read-only",
    "--tmpfs", "/tmp",
    "-m", "512m",
    "--cpus=1",
    "-v", `${cwd}:${cwd}:rw`,
    "--workdir", cwd,
  ];
  if (HOST_UID !== undefined && HOST_GID !== undefined) {
    args.push("--user", `${HOST_UID}:${HOST_GID}`);
  }
  args.push("twocode-sandbox", "bash", "-c", command);

  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });

  let timedOut = false;
  const killTimer = setTimeout(() => {
    timedOut = true;
    Bun.spawn(["docker", "kill", name], { stdout: "ignore", stderr: "ignore" });
  }, TIMEOUT_MS);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(killTimer);

  if (timedOut) {
    return {
      stdout: truncate(stdout, MAX_OUTPUT),
      stderr: "timed out after 30s",
      exitCode: 124,
    };
  }

  return {
    stdout: truncate(stdout, MAX_OUTPUT),
    stderr: truncate(stderr, MAX_OUTPUT),
    exitCode: exitCode ?? 1,
  };
}