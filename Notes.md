# Progress Log

## Milestone 1: Init workspace

### What I built
A root `package.json` declaring a Bun workspaces monorepo (`workspaces: ["packages/*"]`), a root `.gitignore`, and initialized git inside `TwoCode/`. No application packages yet — this is the empty shell everything else will sit inside.

### Why this exists
Every package in this project will need to import from sibling packages (e.g. `server` importing `@nightcode/shared`-equivalent) without publishing to a registry or running a build step first. A workspace root is what makes the package manager resolve those imports by name straight out of `packages/*`.

### Concepts learned
- Bun/npm/pnpm/yarn "workspaces" are a monorepo-lite mechanism: one lockfile, one root `node_modules`, cross-package resolution by `name` field — no publish step required.
- `bun install` with an empty `packages/*` glob is a no-op ("No packages!") — that's expected until packages actually exist, and confirms the workspace config itself is syntactically valid.

### Files created
- `package.json` (root)
- `.gitignore` (root)

### Files modified
- none

### Architecture notes
Reference project's root `package.json` is intentionally tiny: just `name`, `version`, `workspaces`, a few `dev:*`/`build:*` scripts, and one real dependency (`dotenv`, for scripts needing env vars outside any package). No TypeScript project references — cross-package resolution is handled entirely by Bun workspaces, not `tsc`. We're following that same minimalism.

### Challenges encountered
None — this milestone is pure scaffolding.

### Decisions made
- Set `"private": true` on the root package.json (reference project didn't have this field set). Deliberate small deviation: this monorepo will never be published to npm, so marking it private is a correctness improvement, not a stack substitution.

### Things to remember
- `packages/` directory currently exists but is empty — Milestone 3 (scaffold four packages) is what actually populates it with `shared`, `database`, `server`, `cli`.
- No `bun.lock` was generated yet since there are no packages to lock — expect the first real lockfile at Milestone 4 once `shared` and `server` exist and one imports the other.

## Housekeeping: .gitignore update

Added `Notes.md` and `.gitignore` to `.gitignore` itself (user edit, kept as-is per their intent).

## Milestone 2: Shared TS config + .env.example

### What I built
`tsconfig.base.json` at the root — the compiler options every package's own `tsconfig.json` will `extends` — plus a root `.env.example` documenting every environment variable the whole project will eventually need, grouped by the roadmap phase that introduces it.

### Why this exists
Four packages need identical TypeScript strictness/module rules; a shared base avoids copy-pasting (and inevitably drifting) the same compiler options four times. `.env.example` is committed documentation of required config — real values never touch git, but the shape of what's needed is visible to anyone opening the repo.

### Concepts learned
- `noUncheckedIndexedAccess` makes `arr[i]`/`obj[key]` return `T | undefined` instead of lying that it's always `T` — closes a common runtime-crash gap at compile time.
- `moduleResolution: "bundler"` + `module: "Preserve"` + `noEmit: true` together mean `tsc` here is only ever used for type-checking; Bun runs the TypeScript directly and never consumes `tsc`'s output.
- TypeScript project references (`composite`/`references`) are the "proper" large-monorepo answer for fast incremental cross-package type-checking, but add real ceremony (per-package `outDir`, `tsc --build` orchestration). At 4 packages, skipping them is the right call — Bun's workspace resolution already gives us cross-package type-checking for free by resolving straight to `src/`.

### Files created
- `tsconfig.base.json` (root)
- `.env.example` (root)

### Files modified
- none

### Architecture notes
No package's `tsconfig.json` exists yet (that starts at Milestone 3) — each will just be `{ "extends": "../../tsconfig.base.json", ... }` plus any package-specific options (e.g. the CLI package will later need `jsx`/`jsxImportSource` for its terminal-JSX renderer).

### Challenges encountered
None.

### Decisions made
- Chose not to enable `noUnusedLocals`/`noUnusedParameters` for now — early scaffolding milestones often have intentionally unused stubs; can opt into this later per-package if useful.

### Things to remember
- `.env.example` lists Clerk/Polar/Anthropic/OpenAI vars now even though they're not needed until Phase F/H/I — this is documentation, not a requirement to have those accounts yet.
