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

**16 of 44 planned milestones complete** — Phases A–D done, Phase E in progress.

| Phase | Status | What it covers |
|---|---|---|
| A — Monorepo & tooling | ✅ Done | Bun workspaces, shared `tsconfig`, 4 scaffolded packages |
| B — Shared contracts | ✅ Done | Model registry, `Mode`, tool schemas, AI SDK tool contracts |
| C — Database | ✅ Done | Prisma `Session` schema, migration, client singleton |
| D — Server skeleton | ✅ Done | Hono app, error handling, auth/billing stubs, full sessions CRUD, `AppType` export |
| E — CLI skeleton | 🚧 In progress | OpenTUI render boot live; Header, InputBar, routing, providers next |
| F — Chat streaming | ⬜ Not started | Real AI SDK streaming (first working demo) |
| G — Tool calling | ⬜ Not started | Local tool execution, PLAN/BUILD modes |
| H — Real auth | ⬜ Not started | Clerk OAuth |
| I — Real billing | ⬜ Not started | Polar credits |
| J — Polish | ⬜ Not started | Command menu, dialogs, UX |

There's a bare OpenTUI terminal shell now (`bun run dev:cli`), but no real screen, routing, or chat interface yet — just a colored box. First interactive screen and first real AI chat are both still a few milestones out.

## Architecture

```text
packages/
├── shared/     # Model registry, Mode, Zod tool schemas, AI SDK tool contracts
├── database/   # Prisma schema (single Session model) + client singleton
├── server/     # Hono API
└── cli/        # OpenTUI + React terminal client (render boot only so far)
```

Every package is `@twocode/*`, resolved by Bun straight from `src/` via workspace `exports` — no build step for internal consumption.

## Running it locally

**Prerequisites:** [Bun](https://bun.sh), Docker. No AI provider keys, Clerk, or Polar accounts needed yet — those only matter once Phases F/H/I are reached.

```bash
bun install
docker compose up -d              # starts local Postgres
cp .env.example .env              # DATABASE_URL already matches the compose service
bun run --cwd packages/database db:generate
(cd packages/database && bunx prisma migrate deploy)

bun run packages/server/src/index.ts   # http://localhost:3000/health
bun run dev:cli                        # bare OpenTUI terminal shell (no real screen yet)
```

## Contributing to this project (with yourself)

This repo is a teaching exercise, not a race to the finish. Each session should:

1. Pick up at the next unfinished milestone — never redo, never skip ahead.
2. Explain the milestone before writing any code.
3. Verify with something real (a request, a query, a running process) — not just a passing typecheck.
4. Commit once per milestone.
