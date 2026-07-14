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

**40 of 44 planned milestones complete** — Phases A–E done, Phase F nearly there.

| Phase | Status | What it covers |
|---|---|---|
| A — Monorepo & tooling | ✅ Done | Bun workspaces, shared `tsconfig`, 4 scaffolded packages |
| B — Shared contracts | ✅ Done | Model registry, `Mode`, tool schemas, AI SDK tool contracts |
| C — Database | ✅ Done | Prisma `Session` schema, migration, client singleton |
| D — Server skeleton | ✅ Done | Hono app, error handling, auth/billing stubs, full sessions CRUD, `AppType` export |
| E — CLI skeleton | ✅ Done | Static screen, full provider stack, theme switching, routing, real session creation/loading |
| F — Chat streaming | 🚧 Nearly there | Real `/chat` route, `useChat` hook, and client-side tool execution are all live and verified end-to-end — the only missing piece is a real `ANTHROPIC_API_KEY` for an actual streamed reply |
| G — Tool calling | 🚧 Mostly done | Local tool execution (7 tools, PLAN-mode gating, sandboxing) is real and fully verified; needs a live model turn to exercise it end-to-end |
| H — Real auth | ⬜ Not started | Clerk OAuth |
| I — Real billing | ⬜ Not started | Polar credits |
| J — Polish | ⬜ Not started | Command menu, dialogs, UX |

There's a real, themed, routable app now: `Home` → `NewSession` → `Session`, each backed by a real Postgres-persisted session. Typing a message on Home creates a real session and lands you on a real chat screen wired to a real `/chat` endpoint (auth stub, credits stub, session merge, tool resolution, AI SDK `streamText`, all real) and a real `useChat` hook with working client-side tool execution (verified with a synthetic tool call — real file I/O, real sandboxing, real agentic-loop continuation). The one thing not yet provable is an actual model reply, since no `ANTHROPIC_API_KEY` is configured — everything up to that boundary is real and tested. Run it with `bun run dev:cli` (needs `bun run packages/server/src/index.ts` running alongside it).

## Architecture

```text
packages/
├── shared/     # Model registry, Mode, Zod tool schemas, AI SDK tool contracts
├── database/   # Prisma schema (single Session model) + client singleton
├── server/     # Hono API
└── cli/        # OpenTUI + React terminal client (routed screens, real chat wiring, needs an API key)
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
