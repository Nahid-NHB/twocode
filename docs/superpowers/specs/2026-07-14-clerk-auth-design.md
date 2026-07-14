# Clerk auth for TwoCode (Phase H)

## Context

Phase H has been blocked since the original plan: `requireAuth` (`packages/server/src/middleware/require-auth.ts`) stubs a hardcoded `dev-user`, and the CLI's `/login`/`/logout` commands just show "not available yet" toasts. The user has now provisioned a real Clerk dev instance and created an **OAuth Application** in its dashboard, producing:

- `CLERK_FRONTEND_API=https://dear-coral-11.clerk.accounts.dev`
- `CLERK_OAUTH_CLIENT_ID`
- `CLERK_OAUTH_CLIENT_SECRET` (provisioned, but unused by this design — see below)
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (not used by this design either; those are for Clerk's own frontend/backend SDKs, not the OAuth-provider surface)

Confirmed live against `https://dear-coral-11.clerk.accounts.dev/.well-known/openid-configuration`: standard OIDC discovery, `authorization_code` + `refresh_token` grants, PKCE (`S256`) supported, `token_endpoint_auth_methods_supported` includes `none` (public client, no secret required), `offline_access` scope available, JWKS published at `/.well-known/jwks.json`.

## Decisions

1. **Login is mandatory.** Once this ships, unauthenticated requests are rejected (401), not silently treated as `dev-user`. The CLI must prompt `/login` before creating sessions or chatting.
2. **Server verifies tokens locally via JWKS** (not a per-request call to Clerk's `userinfo` endpoint). Adds a `jose` dependency; no network round-trip to Clerk on the request hot path.
3. **Silent refresh via `offline_access`.** One browser login persists indefinitely (until `/logout` or revocation) — the CLI refreshes the `id_token` using the stored `refresh_token` whenever it's near expiry, transparently.
4. **PKCE only — no client secret used anywhere.** The CLI is a public client; embedding a "secret" in a CLI binary isn't actually secret. `token_endpoint_auth_method=none`. `CLERK_OAUTH_CLIENT_SECRET` stays in `.env` unused by this design (harmless to keep, not read by any code path here).
5. **Two milestones**, to keep verification honest at each step:
   - **H1**: server-side verification only, tested against a token obtained by hand.
   - **H2**: the real CLI `/login` flow (PKCE + loopback server + browser), wired end to end, with `requireAuth`'s temporary `dev-user` fallback removed.

## Milestone H1 — Server verifies real Clerk tokens

**Components:**
- Add `jose` to `packages/server`'s dependencies.
- New `packages/server/src/lib/clerk-auth.ts`:
  ```ts
  export async function verifyClerkToken(token: string): Promise<{ userId: string }>
  ```
  Uses `createRemoteJWKSet(new URL(\`${CLERK_FRONTEND_API}/.well-known/jwks.json\`))` (cached in-process by `jose`) and `jwtVerify(token, jwks, { issuer: CLERK_FRONTEND_API, audience: CLERK_OAUTH_CLIENT_ID })`. Returns `{ userId: payload.sub }`; throws on any verification failure.
- `requireAuth` update: read `Authorization: Bearer <token>`.
  - No header at all → **temporary** fallback to `dev-user` (removed in H2 — keeps the CLI working in the gap between these two milestones' commits).
  - Header present but invalid/expired/wrong issuer or audience → real `401 { error: "Unauthorized" }`.
  - Header present and valid → `c.set("userId", payload.sub)`, the real Clerk user id.
- `.env.example` gains `CLERK_FRONTEND_API` / `CLERK_OAUTH_CLIENT_ID` (documented as required starting H1; secret/publishable/secret-key entries stay documented as unused by this feature).

**Verification:** a throwaway script (deleted after, matching the Milestone 46 pattern) drives the full Authorization Code + PKCE exchange by hand — prints the authorize URL, a human (the project owner) opens it and logs in with a real Clerk test user, pastes back the redirected callback URL, the script exchanges the code for a real `id_token`. That token is then used to `curl` a protected route directly, confirming a real `200` with the correct Clerk `sub` reflected as `userId`, and a garbage/expired token is confirmed to produce a real `401`.

## Milestone H2 — Real CLI `/login`

**Components:**
- Add `open` to `packages/cli`'s dependencies (cross-platform system-browser launch).
- New `packages/cli/src/lib/auth.ts`:
  - PKCE `code_verifier`/`code_challenge` + `state` generation (Node's built-in `crypto`, no new dependency).
  - Authorize-URL builder (`scope=openid profile email offline_access`).
  - A `Bun.serve` loopback listener bound to `127.0.0.1` only, trying ports `51219`, `51220`, `51221` in order (first free one wins). **Action required from the project owner before H2 can be tested:** add `http://127.0.0.1:51219/callback`, `http://127.0.0.1:51220/callback`, and `http://127.0.0.1:51221/callback` as allowed redirect URIs on the Clerk OAuth Application in the dashboard — Clerk requires an exact match, and this is a dashboard-only setting no code change can substitute for.
  - Code→token exchange (`grant_type=authorization_code`, `code_verifier`, **no client secret**).
  - `getAuthHeader(): Promise<Record<string,string>>` — returns `{ authorization: "Bearer <id_token>" }`, transparently refreshing via `grant_type=refresh_token` first if the stored token is near/at expiry; returns `{}` if not logged in or refresh fails.
  - `saveAuthTokens` / `clearAuthTokens` / `isLoggedIn` — storage at `~/.twocode/auth.json`, `0600`, directory `0700`, same pattern as `credentials.ts`.
- `/login` command: real dialog — opens the browser immediately, shows a "waiting for you to finish signing in…" state, resolves when the loopback server receives a valid callback, shows a success toast (or a real error: denied, timed out after 5 minutes, `state` mismatch, network failure).
- `/logout` command: calls `clearAuthTokens()`, toasts "Signed out."
- `apiClient`'s `hc` config `headers` option and `useChat`'s `DefaultChatTransport` `headers` option both resolve to `getAuthHeader()` — one shared helper, two call sites, matching how `getApiKey` is already shared today.
- Fail-fast gates at session-creation and message-send: if `isLoggedIn()` is false, show a clear "Sign in required — run /login" message instead of attempting the request (same style as the existing "No API key configured" check in `use-chat.ts`).
- `requireAuth`'s temporary `dev-user` fallback is deleted — a missing header now also 401s. Existing `dev-user`-owned session rows in Postgres become unreachable through the app going forward (acceptable, expected consequence of moving off a stub; no migration).

**Verification:** requires one real human click-through of Clerk's hosted sign-in page (a sandboxed shell can't drive a GUI browser through third-party login UI) — everything up to "open this URL and log in" is automated/driven directly; the rest (loopback capturing the code, token exchange, storage, subsequent authenticated requests) is verified for real afterward: confirm a new session's DB row carries the real Clerk `sub` as `userId` (not `dev-user`), confirm `/logout` followed by a request produces a real 401 and the CLI's sign-in-required messaging, confirm silent refresh by forcing `expiresAt` into the past and confirming the next request refreshes rather than failing.

## Out of scope (this spec)

- Phase I (Polar billing) — untouched.
- Any local `User` table — `userId` stays a bare external id (unchanged from the existing `Session` model comment).
- Migrating/reassigning existing `dev-user` session rows.
- Handling headless/SSH environments with no local browser (manual code-paste fallback) — not needed for this environment; can be a follow-up if it ever matters.
