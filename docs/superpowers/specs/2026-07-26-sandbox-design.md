# Sandbox Design

**Date:** 2026-07-26  
**Scope:** Isolate `bash` tool execution so AI-generated shell commands can't reach outside the project directory, steal credentials, or phone home.

---

## Problem

The `bash` tool in `packages/cli/src/lib/local-tools.ts` runs arbitrary shell commands with full user permissions. A prompt-injected file, a hallucinating model, or a subtly wrong command can:

- Read `~/.ssh`, `~/.twocode/credentials.json`, or any file on the host
- Exfiltrate data via `curl`
- Destroy files outside the project root
- Fork-bomb or OOM the host

File tools (`readFile`, `writeFile`, `editFile`) already have path-traversal protection via `resolveInsideCwd`. `bash` has none beyond a 30s timeout.

---

## Approach

Docker container per bash call. The container:

- Mounts only the project directory (read-write)
- Has no network
- Has no Linux capabilities
- Has a read-only root filesystem with `/tmp` as a writable tmpfs
- Is resource-capped and auto-removed on exit

`grep` stays on the host — it's read-only and doesn't execute arbitrary code.

---

## Architecture

New package `@twocode/sandbox`. The CLI imports from it. No other package changes.

```
packages/
├── sandbox/
│   ├── src/
│   │   ├── index.ts        # runInSandbox(command, cwd): Promise<SandboxResult>
│   │   └── image.ts        # ensureImage(): builds image once, race-safe; reapOrphans(): cleans leftover containers
│   ├── Dockerfile          # Alpine + common dev tools
│   └── package.json
├── cli/
│   └── src/lib/local-tools.ts   # bash case → calls runInSandbox()
```

---

## Sandbox Image

`packages/sandbox/Dockerfile`:

```dockerfile
FROM alpine:3.21
RUN apk add --no-cache bash git nodejs npm python3 make g++ curl
RUN adduser -D -u 1000 sandbox
WORKDIR /workspace
USER sandbox
```

Image tag: `twocode-sandbox`. Built once per machine, not per session.

**Non-root execution.** The image bakes in an unprivileged `sandbox` user (defense in depth — combined with `--cap-drop=ALL` and `--read-only`, a process breakout doesn't land as root). At `docker run` time, `--user <host-uid>:<host-gid>` overrides the baked-in UID with the real host user's, so files written into the bind-mounted project directory come out host-owned instead of owned by container-root or by a mismatched UID 1000. `id -u`/`id -g` are read once at sandbox startup, not per call.

---

## Docker Run Flags

```
docker run \
  --rm \
  --name twocode-<uuid> \
  --network=none \
  --no-new-privileges \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp \
  -m 512m \
  --cpus=1 \
  -v <cwd>:<cwd>:rw \
  --workdir <cwd> \
  --user <host-uid>:<host-gid> \
  twocode-sandbox \
  bash -c <command>
```

| Flag | Blocks |
|---|---|
| `--network=none` | All network egress and ingress |
| `--no-new-privileges` | Privilege escalation via setuid |
| `--cap-drop=ALL` | Raw sockets, mount, chown, etc. |
| `--read-only` | Writes to container root filesystem |
| `--tmpfs /tmp` | Provides writable scratch space |
| `-m 512m --cpus=1` | Fork bombs, OOM host |
| `--rm` | Container cleanup on exit |
| `--user <host-uid>:<host-gid>` | Root-owned files on host; container-root privilege |

Project directory mounted at the same absolute path so relative paths in commands resolve correctly.

**Known limitation:** `--network=none` disables `npm install`, `curl`, `git clone` inside bash. This is intentional — network access is a security boundary, not a convenience toggle.

---

## Image Lifecycle

`ensureImage()` is called once at CLI startup:

1. Run `docker images twocode-sandbox -q`
2. If empty, run `docker buildx build -t twocode-sandbox packages/sandbox/`
3. Build output suppressed unless it fails
4. Subsequent calls are a no-op (image already present)

If bash is called before the build completes, it awaits `ensureImage()`.

**Concurrent-call race.** `ensureImage()` caches its in-flight build as a module-level `Promise<void>`. The first caller starts the build and stores the promise; any call that arrives while a build is running awaits that same promise instead of starting a second `docker buildx build`. The cache is cleared only on failure, so a failed build can be retried by the next call.

**Orphan cleanup.** At the same CLI startup point, before the first bash call, `reapOrphans()` runs `docker ps -a --filter name=twocode- -q` and force-removes any hits. This clears containers left behind by a CLI crash mid-command (`--rm` only fires on normal container exit, not on the CLI process dying). No-ops silently when nothing matches.

---

## Timeout

Each container gets a unique name `twocode-<uuid>`. A `setTimeout` fires at 30s and runs `docker kill <name>`. Result: `{ exitCode: 124, stdout: "", stderr: "timed out after 30s" }`.

---

## Error Handling

| Condition | Behavior |
|---|---|
| Docker not running | Warning toast at CLI startup: "Docker unavailable — bash tool disabled." `bash` throws `Error("bash tool requires Docker")` |
| Docker not installed | Same as above |
| Image build fails | `bash` throws with build stderr |
| Container OOM | `exitCode: 137`, returned as a normal result |
| Timeout | `docker kill`, `exitCode: 124`, error in stderr |
| Normal exit | `{ stdout, stderr, exitCode }` — identical to today |

All errors surface as tool results or thrown errors. The existing `use-chat.ts` hook handles these already.

---

## Testing

Three test files in `packages/sandbox/src/__tests__/`. All require Docker running (consistent with the existing `docker-compose` dependency).

**`sandbox.test.ts`**
- Basic command executes, returns `{ stdout, stderr, exitCode }`
- Timeout kills container, returns `exitCode: 124`
- Network blocked: `curl https://example.com` returns non-zero exitCode
- Host filesystem unreachable: `ls /root` or `cat ~/.ssh/id_rsa` fails
- `/tmp` writable: `touch /tmp/x` succeeds
- Project dir writable: write a file inside container, verify it appears on host
- File ownership: write a file inside container, verify host-side owner matches the calling host user (not root, not UID 1000)

**`image.test.ts`**
- `ensureImage()` called twice — builds once, second call is a no-op (checked via call count + timing)
- `ensureImage()` called concurrently (two overlapping calls before either resolves) — only one build runs, both callers resolve
- `reapOrphans()` with a pre-existing `twocode-*` container present — container is removed; with none present — no-op, no error

**`integration.test.ts`**
- Calls `executeLocalTool("bash", { command: "echo hello" }, "BUILD")` end-to-end
- Verifies full path from tool handler through sandbox returns correct stdout

---

## Out of Scope

- Network-enabled mode (opt-in flag for `npm install` etc.) — not needed now
- Sandboxing `grep` — it's read-only with no code execution
- Windows/macOS support differences — Docker Desktop handles these transparently
- Persisting container state between calls — each call is stateless by design
