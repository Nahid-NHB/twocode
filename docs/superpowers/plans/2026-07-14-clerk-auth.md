# Clerk Auth (Phase H) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `dev-user` auth stub with real Clerk OAuth: the server verifies real Clerk-issued tokens via JWKS, and the CLI's `/login` performs a real PKCE + local-loopback browser sign-in.

**Architecture:** Two milestones. H1 makes `requireAuth` verify real Clerk JWTs locally (via `jose` + Clerk's published JWKS) while still falling back to `dev-user` when no token is sent at all, so the CLI keeps working in between the two milestones' commits. H2 builds the CLI's real `/login` (PKCE, a temporary `Bun.serve` loopback server, system-browser launch, token storage, silent refresh) and then deletes H1's temporary fallback, making auth truly mandatory.

**Tech Stack:** `jose` (server-side JWT/JWKS verification), `open` (CLI browser launch), Bun's built-in `Bun.serve` (loopback callback listener) and `crypto`/`prompt` globals — no other new dependencies.

## Global Constraints

- PKCE only, `token_endpoint_auth_method=none` — no client secret is used anywhere in this feature. `CLERK_OAUTH_CLIENT_SECRET` stays in `.env`, unread by any code path here.
- Clerk endpoints (from live discovery at `https://dear-coral-11.clerk.accounts.dev/.well-known/openid-configuration`): authorize `${CLERK_FRONTEND_API}/oauth/authorize`, token `${CLERK_FRONTEND_API}/oauth/token`, JWKS `${CLERK_FRONTEND_API}/.well-known/jwks.json`.
- Loopback callback ports, in order: `51219`, `51220`, `51221`. **Before H1's verification task and before any H2 testing**, these three exact URIs — `http://127.0.0.1:51219/callback`, `http://127.0.0.1:51220/callback`, `http://127.0.0.1:51221/callback` — must be added as allowed redirect URIs on the Clerk OAuth Application in the dashboard (exact match required; this is a dashboard-only setting, not something any code change can substitute for).
- OAuth scope requested: `openid profile email offline_access`.
- Token storage path: `~/.twocode/auth.json`, directory `0700`, file `0600` — same convention as `packages/cli/src/lib/credentials.ts`.
- This project has no test framework (`bun test`/`vitest`/`jest` are absent everywhere) — its established convention (see `Notes.md`) is verification against a real running server/CLI/database, not unit tests. Every task below verifies this way, not with a test file.

---

## Milestone H1 — Server verifies real Clerk tokens

### Task 1: Add `jose` and verify JWKS-based token verification

**Files:**
- Modify: `packages/server/package.json` (add dependency)
- Create: `packages/server/src/lib/clerk-auth.ts`

**Interfaces:**
- Produces: `verifyClerkToken(token: string): Promise<{ userId: string }>` (throws on any invalid/expired/wrong-issuer/wrong-audience token) — consumed by Task 2.

- [ ] **Step 1: Add the dependency**

Edit `packages/server/package.json`'s `dependencies` block to add, alphabetically:

```json
    "jose": "^6.2.3",
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Create `packages/server/src/lib/clerk-auth.ts`**

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API;
const CLERK_OAUTH_CLIENT_ID = process.env.CLERK_OAUTH_CLIENT_ID;

if (!CLERK_FRONTEND_API) {
  throw new Error("CLERK_FRONTEND_API is not set");
}
if (!CLERK_OAUTH_CLIENT_ID) {
  throw new Error("CLERK_OAUTH_CLIENT_ID is not set");
}

// Cached in-process by jose (respects cooldown/max-age internally) -- no
// network round-trip to Clerk on the request hot path after the first fetch.
const JWKS = createRemoteJWKSet(new URL(`${CLERK_FRONTEND_API}/.well-known/jwks.json`));

export async function verifyClerkToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: CLERK_FRONTEND_API,
    audience: CLERK_OAUTH_CLIENT_ID,
  });

  if (typeof payload.sub !== "string") {
    throw new Error("Clerk token has no subject claim");
  }

  return { userId: payload.sub };
}
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/server && bunx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add packages/server/package.json packages/server/src/lib/clerk-auth.ts bun.lock
git commit -m "Add real Clerk JWT verification via JWKS

verifyClerkToken() checks signature, issuer, and audience against
Clerk's published JWKS -- not wired into requireAuth yet (Task 2)."
```

---

### Task 2: Wire `verifyClerkToken` into `requireAuth` (soft fallback)

**Files:**
- Modify: `packages/server/src/middleware/require-auth.ts`

**Interfaces:**
- Consumes: `verifyClerkToken` from Task 1 (`../lib/clerk-auth`).
- Produces: unchanged `AuthenticatedEnv` type and `c.get("userId")` contract — no downstream route changes needed.

- [ ] **Step 1: Replace the stub**

Replace the full contents of `packages/server/src/middleware/require-auth.ts` with:

```ts
import { createMiddleware } from "hono/factory";
import { verifyClerkToken } from "../lib/clerk-auth";

export type AuthenticatedEnv = {
  Variables: {
    userId: string;
  };
};

// Temporary: a *missing* Authorization header still falls back to "dev-user"
// so the CLI (which doesn't send one until Milestone H2's real /login ships)
// keeps working across the gap between these two milestones' commits. A
// *present* token is always verified for real. This fallback branch is
// deleted in H2, once /login can actually supply a header.
export const requireAuth = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  const header = c.req.header("authorization");

  if (!header) {
    c.set("userId", "dev-user");
    await next();
    return;
  }

  const token = header.replace(/^Bearer\s+/i, "");

  try {
    const { userId } = await verifyClerkToken(token);
    c.set("userId", userId);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/server && bunx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/middleware/require-auth.ts
git commit -m "Wire real Clerk token verification into requireAuth

Missing header still falls back to dev-user (temporary, removed in
H2) but a present token is now really verified against Clerk's JWKS."
```

---

### Task 3: Document the new required env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Edit the Phase H comment block**

In `.env.example`, change:

```
# --- Phase H: Clerk auth (stubbed until then, real values needed later) ---
CLERK_FRONTEND_API=
CLERK_OAUTH_CLIENT_ID=
CLERK_OAUTH_CLIENT_SECRET=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

to:

```
# --- Phase H: Clerk auth ---
# CLERK_FRONTEND_API and CLERK_OAUTH_CLIENT_ID are required (server verifies
# tokens against this issuer/audience; CLI builds the authorize URL from
# them). Create an "OAuth Application" in the Clerk dashboard to get these.
CLERK_FRONTEND_API=
CLERK_OAUTH_CLIENT_ID=
# Not used by this app -- the CLI is a public client and authenticates via
# PKCE only (token_endpoint_auth_method=none), never a client secret.
CLERK_OAUTH_CLIENT_SECRET=
# Not used by this app -- these are for Clerk's own frontend/backend SDKs,
# not the OAuth-provider surface this feature talks to.
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "Document which Clerk env vars this feature actually reads"
```

---

### Task 4: Verify H1 against a real Clerk token

**Files:**
- Create (temporary, deleted at the end of this task): `verify-clerk-token.ts` at the repo root

**Prerequisite:** the three redirect URIs from Global Constraints must already be registered on the Clerk OAuth Application, and the real server must be running (`bun run packages/server/src/index.ts` from the repo root, so `.env` auto-loads).

- [ ] **Step 1: Create the throwaway verification script**

Create `verify-clerk-token.ts` at the repo root:

```ts
import { randomBytes, createHash } from "node:crypto";

const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API;
const CLERK_OAUTH_CLIENT_ID = process.env.CLERK_OAUTH_CLIENT_ID;

if (!CLERK_FRONTEND_API || !CLERK_OAUTH_CLIENT_ID) {
  throw new Error("CLERK_FRONTEND_API and CLERK_OAUTH_CLIENT_ID must be set (they're already in .env)");
}

const REDIRECT_URI = "http://127.0.0.1:51219/callback";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("base64url");

const authorizeUrl = new URL(`${CLERK_FRONTEND_API}/oauth/authorize`);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("client_id", CLERK_OAUTH_CLIENT_ID);
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("code_challenge", challenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

console.log("\n1. Open this URL in a real browser and log in:\n");
console.log(authorizeUrl.toString());
console.log(
  `\n2. ${REDIRECT_URI} must already be registered as an allowed redirect URI on the Clerk OAuth Application.`,
);
console.log(
  "3. After logging in, the browser will fail to load the redirect (nothing is listening on that port) -- that's expected. Copy the full URL from the address bar and paste it below.\n",
);

const pastedUrl = prompt("Paste the redirected URL here:");
if (!pastedUrl) throw new Error("No URL provided");

const callback = new URL(pastedUrl);
const code = callback.searchParams.get("code");
const returnedState = callback.searchParams.get("state");

if (!code) throw new Error(`No code in redirected URL. Query was: ${callback.search}`);
if (returnedState !== state) throw new Error("State mismatch -- possible tampering, aborting");

const tokenRes = await fetch(`${CLERK_FRONTEND_API}/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLERK_OAUTH_CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  }),
});

if (!tokenRes.ok) {
  throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
}

const tokens = (await tokenRes.json()) as { id_token: string };
console.log("\nGot a real id_token. First 40 chars:", tokens.id_token.slice(0, 40), "...\n");

console.log("Testing the server's protected route with this real token...");
const authedRes = await fetch("http://localhost:3000/sessions", {
  headers: { authorization: `Bearer ${tokens.id_token}` },
});
console.log("GET /sessions with real token ->", authedRes.status, await authedRes.text());

const badRes = await fetch("http://localhost:3000/sessions", {
  headers: { authorization: "Bearer garbage-not-a-real-token" },
});
console.log("GET /sessions with garbage token ->", badRes.status, await badRes.text());
```

- [ ] **Step 2: Run it and complete the real login**

Run: `bun run verify-clerk-token.ts` (from the repo root, with the real server already running)
This will print a URL — a human needs to open it in a real browser, log in with a real Clerk test user, then paste the resulting (failed-to-load) redirect URL back into the prompt.
Expected: `GET /sessions with real token -> 200 [...]` and `GET /sessions with garbage token -> 401 {"error":"Unauthorized"}`.

- [ ] **Step 3: Delete the throwaway script**

Run: `rm verify-clerk-token.ts`
Expected: `git status` shows no trace of it (it was never staged/committed).

H1 is done: the server now really verifies Clerk tokens; nothing else changes until H2.

---

## Milestone H2 — Real CLI `/login`

### Task 5: Token storage (`~/.twocode/auth.json`)

**Files:**
- Create: `packages/cli/src/lib/auth/token-store.ts`

**Interfaces:**
- Produces: `AuthTokens` type, `readAuthTokens(): AuthTokens | null`, `saveAuthTokens(tokens: AuthTokens): void`, `clearAuthTokens(): void` — consumed by Task 7 (oauth exchange) and Task 8 (getAuthHeader).

- [ ] **Step 1: Create the file**

```ts
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".twocode");
const AUTH_PATH = join(CONFIG_DIR, "auth.json");

export type AuthTokens = {
  idToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

export function readAuthTokens(): AuthTokens | null {
  try {
    const raw = readFileSync(AUTH_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "idToken" in parsed &&
      "refreshToken" in parsed &&
      "expiresAt" in parsed
    ) {
      return parsed as AuthTokens;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuthTokens(tokens: AuthTokens): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(AUTH_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function clearAuthTokens(): void {
  try {
    unlinkSync(AUTH_PATH);
  } catch {
    // Already gone -- nothing to clean up.
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Verify against the real filesystem**

Run:
```bash
bun -e "
import { saveAuthTokens, readAuthTokens, clearAuthTokens } from './packages/cli/src/lib/auth/token-store.ts';
saveAuthTokens({ idToken: 'a', refreshToken: 'b', expiresAt: 123 });
console.log(readAuthTokens());
clearAuthTokens();
console.log(readAuthTokens());
"
ls -la ~/.twocode/auth.json 2>&1 || true
```
Expected: first `console.log` prints `{idToken: "a", refreshToken: "b", expiresAt: 123}`, second prints `null`, and the final `ls` reports the file is gone (already cleared).

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/auth/token-store.ts
git commit -m "Add auth token storage at ~/.twocode/auth.json

Same 0700/0600 pattern as credentials.ts, but a separate file --
identity has a different lifecycle than provider API keys."
```

---

### Task 6: Add the `open` dependency

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add the dependency**

Edit `packages/cli/package.json`'s `dependencies` block to add, alphabetically:

```json
    "open": "^11.0.0",
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/package.json bun.lock
git commit -m "Add open dependency for launching the system browser"
```

---

### Task 7: PKCE + token exchange (`oauth.ts`)

**Files:**
- Create: `packages/cli/src/lib/auth/oauth.ts`

**Interfaces:**
- Consumes: nothing from other new files.
- Produces: `generatePkce()`, `generateState()`, `buildAuthorizeUrl(params)`, `exchangeCodeForTokens(params)`, `refreshAuthTokens(refreshToken)` — both consumed by Task 8 (`login-flow.ts` and `index.ts`'s `getAuthHeader`).

- [ ] **Step 1: Create the file**

```ts
import { randomBytes, createHash } from "node:crypto";
import type { AuthTokens } from "./token-store";

const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API;
const CLERK_OAUTH_CLIENT_ID = process.env.CLERK_OAUTH_CLIENT_ID;

if (!CLERK_FRONTEND_API) {
  throw new Error("CLERK_FRONTEND_API is not set");
}
if (!CLERK_OAUTH_CLIENT_ID) {
  throw new Error("CLERK_OAUTH_CLIENT_ID is not set");
}

export type PkcePair = { verifier: string; challenge: string };

export function generatePkce(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthorizeUrl(params: { redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(`${CLERK_FRONTEND_API}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLERK_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenEndpointResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: number;
};

function toAuthTokens(response: TokenEndpointResponse): AuthTokens {
  return {
    idToken: response.id_token,
    refreshToken: response.refresh_token,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
}

export async function exchangeCodeForTokens(params: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<AuthTokens> {
  const res = await fetch(`${CLERK_FRONTEND_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLERK_OAUTH_CLIENT_ID!,
      code: params.code,
      code_verifier: params.verifier,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  return toAuthTokens((await res.json()) as TokenEndpointResponse);
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${CLERK_FRONTEND_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLERK_OAUTH_CLIENT_ID!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  return toAuthTokens((await res.json()) as TokenEndpointResponse);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/lib/auth/oauth.ts
git commit -m "Add PKCE generation and Clerk token exchange

No client secret used anywhere -- code_verifier alone secures the
exchange (token_endpoint_auth_method=none), matching a public client."
```

---

### Task 8: Interactive login flow + public auth API

**Files:**
- Create: `packages/cli/src/lib/auth/login-flow.ts`
- Create: `packages/cli/src/lib/auth/index.ts`

**Interfaces:**
- Consumes: `generatePkce`, `generateState`, `buildAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAuthTokens` from `./oauth` (Task 7); `readAuthTokens`, `saveAuthTokens`, `clearAuthTokens` from `./token-store` (Task 5).
- Produces: `runLoginFlow(onStatus: (message: string) => void, signal: AbortSignal): Promise<void>`, `isLoggedIn(): boolean`, `logout(): void`, `getAuthHeader(): Promise<Record<string, string>>` (all from `./index`) — consumed by Task 9 (`api-client.ts`), Task 10 (`use-chat.ts`), Task 11 (`new-session.tsx`), Task 12 (`login-dialog.tsx`), Task 13 (`commands.tsx`).

These two files are created together in this task — `index.ts` imports from `login-flow.ts`, so neither typechecks alone.

- [ ] **Step 1: Create `login-flow.ts`**

```ts
import open from "open";
import { generatePkce, generateState, buildAuthorizeUrl, exchangeCodeForTokens } from "./oauth";
import { saveAuthTokens } from "./token-store";

const CALLBACK_PORTS = [51219, 51220, 51221];
const TIMEOUT_MS = 5 * 60 * 1000;

const SUCCESS_HTML =
  "<html><body><p>Signed in. You can close this tab and return to the terminal.</p></body></html>";
const ERROR_HTML = "<html><body><p>Sign-in failed. You can close this tab and return to the terminal.</p></body></html>";

function startCallbackServer(state: string): { port: number; server: ReturnType<typeof Bun.serve>; result: Promise<string> } {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const result = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  let lastError: unknown;
  for (const port of CALLBACK_PORTS) {
    try {
      const server = Bun.serve({
        port,
        hostname: "127.0.0.1",
        fetch(req) {
          const url = new URL(req.url);
          if (url.pathname !== "/callback") {
            return new Response("Not found", { status: 404 });
          }

          const error = url.searchParams.get("error");
          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");

          if (error) {
            rejectCode(new Error(`Sign-in was denied: ${error}`));
            return new Response(ERROR_HTML, { headers: { "content-type": "text/html" } });
          }

          if (returnedState !== state || !code) {
            rejectCode(new Error("Sign-in failed: state mismatch"));
            return new Response(ERROR_HTML, { headers: { "content-type": "text/html" } });
          }

          resolveCode(code);
          return new Response(SUCCESS_HTML, { headers: { "content-type": "text/html" } });
        },
      });

      return { port, server, result };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Could not start local sign-in server -- ports ${CALLBACK_PORTS.join(", ")} are all in use. (${String(lastError)})`,
  );
}

export async function runLoginFlow(onStatus: (message: string) => void, signal: AbortSignal): Promise<void> {
  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const { port, server, result } = startCallbackServer(state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  try {
    onStatus("Opening your browser…");
    await open(buildAuthorizeUrl({ redirectUri, state, challenge }));

    onStatus("Waiting for you to finish signing in in your browser…");

    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Sign-in timed out after 5 minutes")), TIMEOUT_MS);
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error("Sign-in cancelled"));
      };
      signal.addEventListener("abort", onAbort, { once: true });

      result
        .then((c) => {
          clearTimeout(timeout);
          signal.removeEventListener("abort", onAbort);
          resolve(c);
        })
        .catch((err) => {
          clearTimeout(timeout);
          signal.removeEventListener("abort", onAbort);
          reject(err);
        });
    });

    onStatus("Finishing sign-in…");
    const tokens = await exchangeCodeForTokens({ code, verifier, redirectUri });
    saveAuthTokens(tokens);
  } finally {
    server.stop();
  }
}
```

- [ ] **Step 2: Create `index.ts`**

```ts
import { readAuthTokens, saveAuthTokens, clearAuthTokens } from "./token-store";
import { refreshAuthTokens } from "./oauth";

export { runLoginFlow } from "./login-flow";

// Refresh this far ahead of actual expiry so a slow request never races
// past a token that's still "valid" by a few seconds.
const REFRESH_BUFFER_MS = 60_000;

export function isLoggedIn(): boolean {
  return readAuthTokens() != null;
}

export function logout(): void {
  clearAuthTokens();
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  const tokens = readAuthTokens();
  if (!tokens) return {};

  if (Date.now() < tokens.expiresAt - REFRESH_BUFFER_MS) {
    return { authorization: `Bearer ${tokens.idToken}` };
  }

  try {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    saveAuthTokens(refreshed);
    return { authorization: `Bearer ${refreshed.idToken}` };
  } catch {
    clearAuthTokens();
    return {};
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/auth/login-flow.ts packages/cli/src/lib/auth/index.ts
git commit -m "Add real /login flow: PKCE + loopback callback + browser

Bun.serve listens on 127.0.0.1 only, tries ports 51219-51221, and
is torn down whether the flow succeeds, fails, times out (5 min),
or is cancelled (AbortSignal) -- no lingering bound port. getAuthHeader()
silently refreshes via offline_access when the stored token is
near expiry."
```

---

### Task 9: Attach the auth header to plain API requests

**Files:**
- Modify: `packages/cli/src/lib/api-client.ts`

**Interfaces:**
- Consumes: `getAuthHeader` from `../lib/auth` (Task 8).

- [ ] **Step 1: Replace the file**

```ts
import { hc } from "hono/client";
import type { AppType } from "@twocode/server";
import { getAuthHeader } from "./auth";

export const apiClient = hc<AppType>(process.env.API_URL ?? "http://localhost:3000", {
  headers: getAuthHeader,
});
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/lib/api-client.ts
git commit -m "Attach the real auth token to every /sessions request"
```

---

### Task 10: Attach the auth header to chat requests + fail fast

**Files:**
- Modify: `packages/cli/src/hooks/use-chat.ts:1-19,37-58` (imports and the `prepareSendMessagesRequest` body)

**Interfaces:**
- Consumes: `getAuthHeader`, `isLoggedIn` from `../lib/auth` (Task 8).

- [ ] **Step 1: Add the import**

In `packages/cli/src/hooks/use-chat.ts`, add alongside the existing `getApiKey` import:

```ts
import { getApiKey } from "../lib/credentials";
import { getAuthHeader, isLoggedIn } from "../lib/auth";
```

- [ ] **Step 2: Fail fast when not logged in, and attach the header**

In the same file's `DefaultChatTransport` constructor, add the login check as the first line of `prepareSendMessagesRequest`, and add a `headers` option to the transport:

```ts
    return new DefaultChatTransport<Message>({
      api: apiClient.chat.$url().toString(),
      headers: getAuthHeader,
      prepareSendMessagesRequest({ messages }) {
        if (!isLoggedIn()) {
          throw new Error("Sign in required. Run /login to continue.");
        }

        const message = messages[messages.length - 1];
```

(The rest of `prepareSendMessagesRequest`'s body is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/hooks/use-chat.ts
git commit -m "Attach the real auth token to /chat requests, fail fast if signed out

Same style as the existing 'No API key configured' check -- a clear
message pointing at /login instead of a raw 401 from the server."
```

---

### Task 11: Fail fast on session creation when not logged in

**Files:**
- Modify: `packages/cli/src/screens/new-session.tsx:1-9,44-51`

**Interfaces:**
- Consumes: `isLoggedIn` from `../lib/auth` (Task 8).

- [ ] **Step 1: Add the import**

In `packages/cli/src/screens/new-session.tsx`, add alongside the existing imports:

```ts
import { getErrorMessage } from "../lib/http-errors";
import { isLoggedIn } from "../lib/auth";
```

- [ ] **Step 2: Check before creating the session**

Inside the `createSession` function's `try` block, add the check as its first line:

```ts
    const createSession = async () => {
      try {
        if (!isLoggedIn()) {
          throw new Error("Sign in required. Run /login to continue.");
        }

        const res = await apiClient.sessions.$post({
          json: { title: state.message.slice(0, 100) },
        });
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/screens/new-session.tsx
git commit -m "Fail fast on session creation when not signed in"
```

---

### Task 12: Real `/login` dialog

**Files:**
- Create: `packages/cli/src/components/dialogs/login-dialog.tsx`

**Interfaces:**
- Consumes: `runLoginFlow` from `../../lib/auth` (Task 8); `useDialog` from `../../providers/dialog`; `useToast` from `../../providers/toast`; `Spinner` from `../spinner`.
- Produces: `LoginDialogContent` component — consumed by Task 13 (`commands.tsx`).

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useRef, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useDialog } from "../../providers/dialog";
import { useToast } from "../../providers/toast";
import { useTheme } from "../../providers/theme";
import { runLoginFlow } from "../../lib/auth";
import { Spinner } from "../spinner";

export function LoginDialogContent() {
  const dialog = useDialog();
  const toast = useToast();
  const { colors } = useTheme();
  const [status, setStatus] = useState("Opening your browser…");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    let cancelled = false;
    const controller = controllerRef.current;

    runLoginFlow((message) => {
      if (!cancelled) setStatus(message);
    }, controller.signal)
      .then(() => {
        if (cancelled) return;
        toast.show({ variant: "success", message: "Signed in." });
        dialog.close();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dialog, toast]);

  if (error) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={colors.error}>{error}</text>
        <text attributes={TextAttributes.DIM}>Run /login to try again.</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <Spinner />
        <text>{status}</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to cancel</text>
    </box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/components/dialogs/login-dialog.tsx
git commit -m "Add real /login dialog: browser + waiting state + errors

Escape closes the dialog (existing DialogProvider behavior) and
aborts the in-flight login via AbortController, so the loopback
server is torn down immediately rather than left bound for 5 minutes."
```

---

### Task 13: Wire `/login` and `/logout` to real behavior

**Files:**
- Modify: `packages/cli/src/components/command-menu/commands.tsx`

**Interfaces:**
- Consumes: `LoginDialogContent` from `../dialogs/login-dialog` (Task 12); `logout` from `../../lib/auth` (Task 8).

- [ ] **Step 1: Add imports**

At the top of `packages/cli/src/components/command-menu/commands.tsx`, add:

```ts
import { LoginDialogContent } from "../dialogs/login-dialog";
import { logout } from "../../lib/auth";
```

- [ ] **Step 2: Replace the `/login` command's action**

Replace:

```ts
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "Sign-in isn't available yet — this needs a real Clerk OAuth app (Phase H).",
      });
    },
```

(the one under `name: "login"`) with:

```ts
    action: (ctx) => {
      ctx.dialog.open({
        title: "Sign In",
        children: <LoginDialogContent />,
      });
    },
```

- [ ] **Step 3: Replace the `/logout` command's action**

Replace:

```ts
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "There's no real session to sign out of yet — auth is still the dev-user stub (Phase H).",
      });
    },
```

(the one under `name: "logout"`) with:

```ts
    action: (ctx) => {
      logout();
      ctx.toast.show({ variant: "info", message: "Signed out." });
    },
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/cli && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/components/command-menu/commands.tsx
git commit -m "Wire /login and /logout to real behavior"
```

---

### Task 14: Make auth mandatory (remove H1's temporary fallback)

**Files:**
- Modify: `packages/server/src/middleware/require-auth.ts`

- [ ] **Step 1: Replace the file**

```ts
import { createMiddleware } from "hono/factory";
import { verifyClerkToken } from "../lib/clerk-auth";

export type AuthenticatedEnv = {
  Variables: {
    userId: string;
  };
};

export const requireAuth = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { userId } = await verifyClerkToken(token);
    c.set("userId", userId);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/server && bunx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/middleware/require-auth.ts
git commit -m "Make auth mandatory -- remove the dev-user fallback

Every request now needs a real, valid Clerk token. Existing
dev-user-owned Session rows become unreachable through the app
going forward -- expected, no migration."
```

---

### Task 15: End-to-end verification (requires a real human sign-in)

No files change in this task — it's verification only.

- [ ] **Step 1: Start both processes for real**

Run (separate terminals): `bun run packages/server/src/index.ts` and `bun run dev:cli`.

- [ ] **Step 2: Confirm mandatory gating works**

In the CLI, with `~/.twocode/auth.json` absent (run `rm -f ~/.twocode/auth.json` first if it exists), type a message at Home and press enter.
Expected: a toast/error reading "Sign in required. Run /login to continue." — no session gets created.

- [ ] **Step 3: Run `/login` and complete it for real**

Run `/login`. A browser should open to Clerk's real sign-in page. **A human needs to log in with a real Clerk test user here** — this cannot be automated (no sandboxed shell can drive a real GUI browser through third-party login UI).
Expected: the dialog shows "Opening your browser…" then "Waiting for you to finish signing in…", then closes with a "Signed in." toast once the browser tab redirects back.

- [ ] **Step 4: Confirm the token file is real**

Run: `cat ~/.twocode/auth.json`
Expected: real `idToken`/`refreshToken` strings and a future `expiresAt` (not the `a`/`b`/`123` test values from Task 5).

- [ ] **Step 5: Confirm a session now works, with the real Clerk user id**

In the CLI, type a message and send it. Then check the database directly:

Run: `docker exec twocode-postgres psql -U twocode -d twocode -c "select id, \"userId\" from \"Session\" order by \"createdAt\" desc limit 1;"`
Expected: the newest row's `userId` is a real Clerk `sub` value (starts with `user_`), not `dev-user`.

- [ ] **Step 6: Confirm silent refresh works**

Run: force the stored token to look expired, then send another message:
```bash
bun -e "
import { readAuthTokens, saveAuthTokens } from '/home/nahid/1Projects/TwoHarness/TwoCode/packages/cli/src/lib/auth/token-store.ts';
const tokens = readAuthTokens();
if (!tokens) throw new Error('not logged in');
saveAuthTokens({ ...tokens, expiresAt: Date.now() - 1000 });
"
```
Then send another message in the CLI.
Expected: the request still succeeds (no "Sign in required" error) and `cat ~/.twocode/auth.json` now shows a new `idToken`/`expiresAt` — proving the refresh happened silently rather than failing.

- [ ] **Step 7: Confirm `/logout` and the resulting 401**

Run `/logout` in the CLI. Confirm the toast reads "Signed out." and `cat ~/.twocode/auth.json` fails (file gone). Then try sending another message.
Expected: "Sign in required. Run /login to continue." again — same as Step 2, proving logout took effect.

This task has no commit — it's pure verification of everything committed in Tasks 1–15.

---

## Self-Review Notes

- **Spec coverage:** every decision in `docs/superpowers/specs/2026-07-14-clerk-auth-design.md` maps to a task above — mandatory login (Tasks 10, 11, 14, verified in 15), local JWKS verification (Tasks 1–2), offline_access silent refresh (Task 8, verified in 15 Step 6), PKCE-only/no secret (Task 7), the two-milestone split (H1 = Tasks 1–4, H2 = Tasks 5–15), and the dashboard redirect-URI prerequisite (Global Constraints, referenced again in Task 4).
- **Type consistency checked:** `AuthTokens` (Task 5) is the same shape produced by `oauth.ts` (Task 7) and consumed by `login-flow.ts` and `index.ts` (both Task 8). `runLoginFlow`'s signature — `(onStatus: (message: string) => void, signal: AbortSignal): Promise<void>` — matches between its definition and its two call sites (Task 8's own re-export, Task 12's dialog).
- **Out of scope**, per the spec: Phase I billing, any local `User` table, migrating `dev-user` rows, headless/SSH manual-code-paste fallback.
