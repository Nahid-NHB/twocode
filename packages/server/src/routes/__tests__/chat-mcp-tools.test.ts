import { describe, expect, test } from "bun:test";
import { mcpToolsToAiTools, type McpToolEntry } from "../../lib/mcp-tools";

describe("mcpToolsToAiTools", () => {
  test("returns an empty object for an undefined input", () => {
    expect(mcpToolsToAiTools(undefined)).toEqual({});
  });

  test("returns an empty object for an empty array", () => {
    expect(mcpToolsToAiTools([])).toEqual({});
  });

  test("maps each entry to an AI SDK tool with the namespaced name, description, and JSON Schema", () => {
    const entries: McpToolEntry[] = [
      {
        name: "mcp__mock__echo",
        description: "Echoes the input back.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      {
        name: "mcp__mock__fail",
        description: "Always throws.",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const tools = mcpToolsToAiTools(entries);

    expect(Object.keys(tools).sort()).toEqual(["mcp__mock__echo", "mcp__mock__fail"]);

    // Each entry has no `execute` -- the server is describe-only, matching
    // the same pattern the 7 built-in tool contracts use.
    expect((tools["mcp__mock__echo"] as { execute?: unknown }).execute).toBeUndefined();
    expect((tools["mcp__mock__fail"] as { execute?: unknown }).execute).toBeUndefined();

    // Description is preserved verbatim.
    expect((tools["mcp__mock__echo"] as { description: string }).description).toBe(
      "Echoes the input back.",
    );
  });

  test("last entry wins on name collision (caller should namespace uniquely)", () => {
    const entries: McpToolEntry[] = [
      { name: "mcp__a__tool", description: "first", inputSchema: { type: "object" } },
      { name: "mcp__a__tool", description: "second", inputSchema: { type: "object" } },
    ];

    const tools = mcpToolsToAiTools(entries);
    expect((tools["mcp__a__tool"] as { description: string }).description).toBe("second");
  });
});
