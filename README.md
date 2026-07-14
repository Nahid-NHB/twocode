<div align="center">

<h1>TwoCode</h1>

<p>A from-scratch rebuild of <a href="https://github.com/code-with-antonio/nightcode">NightCode</a> (a terminal AI coding agent), built one small, explained milestone at a time to learn the architecture rather than copy it.</p>

<p>
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />&nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />&nbsp;
  <img src="https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white" alt="Hono" />&nbsp;
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />&nbsp;
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />&nbsp;
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

</div>

<br />

## What this is

`nightcode/` (a sibling directory) is a fully-built reference implementation. `TwoCode/` is the same architecture, rebuilt from understanding — no copied code — one milestone at a time, each explained, verified, and committed on its own. Progress and reasoning for every milestone lives in [`Notes.md`](./Notes.md).

## Status

**44 of 44 planned milestones complete, plus post-plan polish (Milestone 45).** Every phase that's reachable without external service credentials this environment doesn't have is done. Phases H (Clerk OAuth) and I (Polar billing) are genuinely blocked on real accounts — their stubs are the intended state until someone picks this up with real credentials in hand.

| Phase | Status | What it covers |
|---|---|---|
| A — Monorepo & tooling | ✅ Done | Bun workspaces, shared `tsconfig`, 4 scaffolded packages |
| B — Shared contracts | ✅ Done | Model registry, `Mode`, tool schemas, AI SDK tool contracts |
| C — Database | ✅ Done | Prisma `Session` schema, migration, client singleton |
| D — Server skeleton | ✅ Done | Hono app, error handling, auth/billing stubs, full sessions CRUD, `AppType` export |
| E — CLI skeleton | ✅ Done | Static screen, full provider stack, theme switching, routing, session create/browse/resume |
| F — Chat streaming | ✅ Done (needs a key) | Real `/chat` route, `useChat` hook, full message rendering (reasoning/tool-call/text) — verified end-to-end with a synthetic model response; only missing piece is a real `ANTHROPIC_API_KEY` for an actual reply |
| G — Tool calling | ✅ Done | Client-side execution of all 7 tools (PLAN-mode gating, sandboxing), fully real-verified with no key needed; the agentic loop (tool call → execute → continue) verified live |
| H — Real auth | ⛔ Blocked | Needs a real Clerk OAuth app — `requireAuth` stays the `dev-user` stub until then |
| I — Real billing | ⛔ Blocked | Needs a real Polar account — `requireCreditsBalance` stays a no-op until then |
| J — Polish | ✅ Done | Full command menu (theme/agents/models/sessions/new/exit all real), tab-key mode toggle, focus-restoration fix |

This is a real, themed, fully-routable terminal app: `Home` → `NewSession` → `Session`, each backed by a real Postgres-persisted session. Typing a message creates a real session and lands on a real chat screen wired to a real `/chat` endpoint and a real `useChat` hook with working client-side tool execution and full message rendering (reasoning, tool calls, text, a mode/model/duration footer). The command menu is fully live: `/theme`, `/agents`, `/models`, `/sessions`, `/new`, `/exit` all do something real; `/login`, `/logout`, `/upgrade`, `/usage` show a clear toast explaining they need Phase H/I credentials, rather than silently doing nothing. The one thing not provable end-to-end is an actual model reply, since no `ANTHROPIC_API_KEY` is configured — everything up to that boundary (auth, credits, session merge, tool resolution, the real request reaching Anthropic's API, even a down-server network failure) is real and tested; drop a key in `.env` to see it go all the way. Run it with `bun run dev:cli` (needs `bun run packages/server/src/index.ts` running alongside it).

## Architecture

```text
packages/
├── shared/     # Model registry, Mode, Zod tool schemas, AI SDK tool contracts
├── database/   # Prisma schema (single Session model) + client singleton
├── server/     # Hono API
└── cli/        # OpenTUI + React terminal client (fully routed, real chat + tool execution, needs an API key)
```

Every package is `@twocode/*`, resolved by Bun straight from `src/` via workspace `exports` — no build step for internal consumption.

## Running it locally

**Prerequisites:** [Bun](https://bun.sh), Docker. Clerk/Polar accounts aren't needed yet (Phases H/I). An `ANTHROPIC_API_KEY` in `.env` is optional — everything works without one except getting an actual model reply back from `/chat` (you'll see a real, expected auth error instead).

```bash
bun install
docker compose up -d              # starts local Postgres
cp .env.example .env              # DATABASE_URL already matches the compose service; add ANTHROPIC_API_KEY for real replies
bun run --cwd packages/database db:generate
(cd packages/database && bunx prisma migrate deploy)

bun run packages/server/src/index.ts   # http://localhost:3000/health
bun run dev:cli                        # Home -> type a message -> real session -> real chat screen
```

## Contributing to this project (with yourself)

This repo is a teaching exercise, not a race to the finish. Each session should:

1. Pick up at the next unfinished milestone — never redo, never skip ahead.
2. Explain the milestone before writing any code.
3. Verify with something real (a request, a query, a running process) — not just a passing typecheck.
4. Commit once per milestone.
