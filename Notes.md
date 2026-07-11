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
