// MCP server connection management. Reads ~/.twocode/mcp.json, spawns
// each configured server as a stdio child process via the AI SDK's
// @ai-sdk/mcp client, and keeps an in-memory registry of every
// successfully discovered tool for the lifetime of the CLI process.
//
// Tool names are namespaced as `mcp__<server>__<tool>` to make
// collisions with the 7 built-in tools structurally impossible.
//
// One failure (malformed config, missing binary, server crash on
// startup) never brings down the rest of the app: connectMcpServers
// returns a per-server failures list rather than rejecting.

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

const CONFIG_PATH = join(homedir(), ".twocode", "mcp.json");
const TOOL_TIMEOUT_MS = 30_000;

// Tests point this at a fixture file so loadMcpConfig() doesn't try to
// read the user's real ~/.twocode/mcp.json. Production code leaves it
// untouched.
let configPathOverride: string | null = null;

export function __setMcpConfigPathForTests(path: string | null): void {
  configPathOverride = path;
}

const mcpConfigSchema = z.object({
  mcpServers: z.record(
    z.string(),
    z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

export type McpConfig = z.infer<typeof mcpConfigSchema>;

export type McpTool = {
  name: string;
  description: string;
  inputSchema: unknown;
};

export type McpConnectionFailure = {
  server: string;
  reason: string;
};

export type McpConnectionResult = {
  tools: McpTool[];
  failures: McpConnectionFailure[];
};

// In-memory registry. Populated once at startup by connectMcpServers()
// (typically called from McpStartupCheck on mount), read on every
// /chat request and on every MCP tool call.
type ServerEntry = {
  client: Awaited<ReturnType<typeof createMCPClient>>;
  tools: McpTool[];
};

const serverEntries = new Map<string, ServerEntry>();

function namespacedName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`;
}

export function loadMcpConfig(): McpConfig | null {
  const path = configPathOverride ?? CONFIG_PATH;
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read ~/.twocode/mcp.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid ~/.twocode/mcp.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = mcpConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `Invalid ~/.twocode/mcp.json: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return parsed.data;
}

export async function connectMcpServers(
  config: McpConfig,
): Promise<McpConnectionResult> {
  const tools: McpTool[] = [];
  const failures: McpConnectionFailure[] = [];

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = await createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: serverConfig.command,
          args: serverConfig.args ?? [],
          env: serverConfig.env
            ? { ...(process.env as Record<string, string>), ...serverConfig.env }
            : (process.env as Record<string, string>),
        }),
      });

      const list = await client.listTools();
      const serverTools: McpTool[] = list.tools.map((tool) => ({
        name: namespacedName(serverName, tool.name),
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
      }));

      serverEntries.set(serverName, { client, tools: serverTools });
      tools.push(...serverTools);
    } catch (error) {
      failures.push({
        server: serverName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { tools, failures };
}

export async function callMcpTool(
  fullName: string,
  args: unknown,
): Promise<unknown> {
  const match = fullName.match(/^mcp__(.+?)__(.+)$/);
  if (!match) {
    throw new Error(`Invalid MCP tool name: ${fullName}`);
  }
  const [, serverName, toolName] = match;
  const entry = serverEntries.get(serverName!);
  if (!entry) {
    throw new Error(`MCP server not connected: ${serverName}`);
  }
  if (!entry.tools.some((t) => t.name === fullName)) {
    throw new Error(`MCP tool not found: ${fullName}`);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`MCP tool ${fullName} timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
      TOOL_TIMEOUT_MS,
    );
  });

  try {
    const result = await Promise.race([
      entry.client.callTool({
        name: toolName!,
        arguments: (args ?? {}) as Record<string, unknown>,
      }),
      timeout,
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getMcpToolsForRequest(): McpTool[] {
  const tools: McpTool[] = [];
  for (const entry of serverEntries.values()) {
    tools.push(...entry.tools);
  }
  return tools;
}

export function getMcpServerStatus(): Array<{
  name: string;
  status: "connected";
  toolCount: number;
}> {
  const status: Array<{ name: string; status: "connected"; toolCount: number }> = [];
  for (const [name, entry] of serverEntries) {
    status.push({ name, status: "connected", toolCount: entry.tools.length });
  }
  return status;
}

export async function closeMcpServers(): Promise<void> {
  await Promise.all(
    Array.from(serverEntries.values()).map((entry) =>
      entry.client.close().catch(() => {
        // Best-effort cleanup; a failed close shouldn't block shutdown.
      }),
    ),
  );
  serverEntries.clear();
}
