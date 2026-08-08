# MCP Server Support Design

**Date:** 2026-08-08
**Scope:** Let TwoCode's agent call tools exposed by user-configured MCP (Model Context Protocol) servers, alongside the existing 7 built-in tools (`readFile`, `listDirectory`, `glob`, `grep`, `writeFile`, `editFile`, `bash`).

---

## Problem

TwoCode's tool set is currently fixed: `@twocode/shared`'s `toolInputSchemas`/`buildToolContracts` hardcode exactly 7 tools, described to the model by the server and executed locally by the CLI (`packages/cli/src/lib/local-tools.ts`). There's no way to extend what the agent can do without shipping a new TwoCode release. MCP is the standard protocol for exactly this: a local server process exposes a set of tools over stdio, and any MCP-aware client can discover and call them. Adding MCP support lets users plug in filesystem, database, API, or any other MCP server without TwoCode needing to know about it in advance.

---

## Approach

v1 supports **stdio-only** MCP servers (local child processes — matches how Claude Desktop/Code configs work; no network/auth surface to design around). Servers are configured in `~/.twocode/mcp.json`, connected once at CLI startup, and their tools are merged into the model's tool set on every `/chat` request. Execution happens CLI-side, exactly like the existing built-in tools, because the CLI is the only side with a local process to talk to.

---

## Config

`~/.twocode/mcp.json`, same shape as Claude Desktop/Code's own config, so existing configs can be copied in verbatim:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    }
  }
}
```

A missing file means zero configured servers — zero behavior change from today. `env` is optional and merges with (doesn't replace) the CLI's own environment when spawning the server process.

---

## Architecture

```
packages/
├── cli/
│   ├── src/lib/
│   │   ├── mcp-servers.ts          # connectMcpServers(), tool registry, per-server client handles
│   │   └── local-tools.ts          # unchanged — still owns the 7 built-in tools
│   ├── src/hooks/use-chat.ts       # onToolCall gains an mcp__ branch
│   └── src/layouts/root-layout.tsx # McpStartupCheck component (sibling to DockerStartupCheck)
├── server/
│   └── src/routes/chat.ts          # accepts a `mcpTools` list in the request body, merges ad-hoc
│                                    # tool() defs into getToolContracts(mode)'s result for that call
└── shared/
    └── src/schemas.ts              # unchanged — MCP tools never become static contracts here
```

No new workspace package. MCP-specific logic lives in `packages/cli/src/lib/mcp-servers.ts`; the server route gains a small amount of per-request tool-building logic instead of a fixed import.

---

## Lifecycle

`McpStartupCheck`, mounted alongside the existing `DockerStartupCheck` in `root-layout.tsx`, runs once at CLI startup:

1. Read `~/.twocode/mcp.json`. No file or empty `mcpServers` → no-op.
2. For each entry, spawn the server via AI SDK's MCP stdio client (`@ai-sdk/mcp`, already a transitive dependency via `@ai-sdk/react`) and call its tool-list method.
3. A server that fails to spawn or respond gets a toast (`MCP server 'foo' failed to start: <reason>`) and is skipped — it never blocks the rest of the app or other servers' connections.
4. Successfully connected servers' tool lists are kept in an in-memory registry for the life of the CLI process; connections stay open for the whole session (matches the "once at CLI startup" pattern already established for Docker).

---

## Tool Naming

Every discovered tool is namespaced `mcp__<server>__<tool>` (matching the convention already used for this session's own MCP-backed tools). This makes collisions — across MCP servers, and with the 7 built-ins — structurally impossible without any dedup logic.

---

## Request Flow

`useChat`'s transport (`packages/cli/src/hooks/use-chat.ts`) includes the in-memory registry's flattened `{name, description, inputSchema}` list as `mcpTools` in the `/chat` request body, alongside the existing `mode`/`provider`/`model`/`apiKey`. Empty registry → empty array → no change to today's request shape in effect.

Server-side, `chat.ts` converts each entry into an AI SDK `tool()` via `jsonSchema()` (no `execute`, same pattern the 7 static contracts already use) and merges the result into `getToolContracts(mode)`'s output for that single request. Nothing MCP-related is ever imported into `@twocode/shared` — the server has no static knowledge of any MCP tool; it only ever sees what a given request declares.

---

## Execution

`onToolCall` in `use-chat.ts` gains one branch: a tool name prefixed `mcp__` is parsed back into `(server, tool)`, routed to that server's connected client's call method instead of `executeLocalTool`, and wrapped in the same 30s timeout convention `bash` already uses. The result (or timeout/error) goes back through `chat.addToolOutput` exactly like every other tool today — no changes to the AI SDK message-handling path.

---

## PLAN Mode

MCP tools are blocked entirely in PLAN mode, the same as `writeFile`/`editFile`/`bash` — PLAN mode stays exactly the 4 read-only built-ins, nothing more. No per-server trust configuration in v1.

---

## `/mcp` Command

A new dialog, reusing the existing `DialogSearchList` pattern (`/provider`, `/models`), listing each configured server with its live status: connected (tool count) or failed (error). v1 is **read-only** — no in-app add/remove, since the config format is explicitly meant to be copied from elsewhere, not typed into a wizard. Editing `~/.twocode/mcp.json` by hand and restarting the CLI is the only way to change servers, matching how Claude Desktop/Code themselves work.

---

## Error Handling

| Condition | Behavior |
|---|---|
| `mcp.json` missing or empty | No-op — zero configured servers, zero behavior change |
| `mcp.json` malformed JSON | Startup toast: "Failed to parse ~/.twocode/mcp.json — MCP servers disabled." All servers skipped. |
| One server fails to spawn/connect | Toast naming that server; its tools just aren't offered. Other servers unaffected. |
| MCP tool call times out (30s) | Same shape as `bash`'s timeout: tool result carries a timeout error, chat continues |
| MCP tool call throws | Routed through `addToolOutput`'s `state: "output-error"` path, same as any local tool error today |

---

## Testing

**`packages/cli/src/lib/__tests__/mcp-servers.test.ts`**
- Connects to a real, minimal test MCP server — a fixture script at `packages/cli/src/lib/__tests__/fixtures/mock-mcp-server.ts`, exposing one trivial tool (e.g. `echo`) over stdio using the same `@ai-sdk/mcp` primitives the CLI itself uses to build a server — and confirms tool discovery returns the expected `{name, description, inputSchema}` shape
- A server pointed at a nonexistent command fails to connect without throwing out of `connectMcpServers()` — returns a per-server failure, not a rejected promise for the whole batch
- Tool names come back correctly namespaced `mcp__<server>__<tool>`

**`packages/server/src/routes/__tests__/chat-mcp-tools.test.ts`**
- A request with a non-empty `mcpTools` array produces a tool set that includes both the static 7 (respecting `mode`) and the ad-hoc MCP ones
- A request with an empty/missing `mcpTools` array produces exactly today's tool set — no regression

**`packages/cli/src/hooks/__tests__/use-chat-mcp.test.ts`** (or extends existing use-chat tests)
- `onToolCall` for a tool name prefixed `mcp__` routes to the MCP client path, not `executeLocalTool`
- Timeout wrapping fires the same way it does for `bash`

---

## Out of Scope

- HTTP/SSE remote MCP servers — stdio only for v1
- In-app add/remove UI for `/mcp` — hand-edit the config file
- Per-server PLAN-mode trust flag — all MCP tools blocked in PLAN mode, no exceptions
- Hot-reloading `mcp.json` — changes require a CLI restart, same as how provider credentials work today
- Tool-level allow/deny lists within a single MCP server — a connected server's full tool list is offered as-is
