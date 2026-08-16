// Minimal MCP server fixture for tests. Exposes one `echo` tool that
// returns its input, plus a `fail` tool that always throws. Tests spawn
// this via `Bun.spawn([bun, "run", <this file>])` -- the CLI's
// Experimental_StdioMCPTransport talks to it over stdio using the same
// JSON-RPC framing Claude Desktop/Code use.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mock",
  version: "0.0.0",
});

server.tool(
  "echo",
  "Echoes the input back as the tool result.",
  {
    text: z.string().describe("Text to echo back."),
  },
  async (args) => {
    return {
      content: [{ type: "text" as const, text: args.text }],
    };
  },
);

server.tool(
  "fail",
  "Always throws.",
  {},
  async () => {
    throw new Error("mock-mcp-server: fail tool was called");
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
