import { jsonSchema, tool } from "ai";

export type McpToolEntry = {
  name: string;
  description: string;
  inputSchema: unknown;
};

// Build a sparse ToolSet from the per-request MCP tool catalog sent by
// the CLI. The static 7 built-in tools are still provided by the route
// via `getToolContracts(mode)`; this helper only adds the MCP entries
// on top. Each entry has no `execute` -- the CLI is the only side that
// can resolve an `mcp__<server>__<tool>` call through to the connected
// stdio server, so the server route just describes the tool to the model.
//
// Returns a plain object keyed by tool name, suitable for spreading
// into the existing tool set. The schema is passed through `jsonSchema`
// so the SDK can send it to the provider as a regular JSON Schema.
export function mcpToolsToAiTools(
  entries: McpToolEntry[] | undefined,
): Record<string, ReturnType<typeof tool>> {
  const result: Record<string, ReturnType<typeof tool>> = {};
  if (!entries) return result;
  for (const entry of entries) {
    result[entry.name] = tool({
      description: entry.description,
      inputSchema: jsonSchema(entry.inputSchema as Parameters<typeof jsonSchema>[0]),
    });
  }
  return result;
}
