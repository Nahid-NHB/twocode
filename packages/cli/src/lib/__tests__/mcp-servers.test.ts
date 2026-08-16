import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  __setMcpConfigPathForTests,
  callMcpTool,
  closeMcpServers,
  connectMcpServers,
  getMcpToolsForRequest,
  loadMcpConfig,
} from "../mcp-servers";

const MOCK_SERVER_SCRIPT = resolve(
  __dirname,
  "fixtures/mock-mcp-server.ts",
);

let configDir: string;
let configPath: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "twocode-mcp-cfg-"));
  configPath = join(configDir, "mcp.json");
  __setMcpConfigPathForTests(configPath);
});

afterEach(async () => {
  await closeMcpServers();
  __setMcpConfigPathForTests(null);
  rmSync(configDir, { recursive: true, force: true });
});

function writeConfig(json: unknown): void {
  writeFileSync(configPath, JSON.stringify(json, null, 2), "utf-8");
}

describe("loadMcpConfig", () => {
  test("returns null when config file is missing", () => {
    expect(loadMcpConfig()).toBeNull();
  });

  test("parses a valid config", () => {
    writeConfig({
      mcpServers: {
        mock: { command: "bun", args: ["run", MOCK_SERVER_SCRIPT] },
      },
    });
    const config = loadMcpConfig();
    expect(config).not.toBeNull();
    expect(config!.mcpServers.mock.command).toBe("bun");
  });

  test("throws on malformed JSON", () => {
    writeFileSync(configPath, "not json", "utf-8");
    expect(() => loadMcpConfig()).toThrow(/Invalid/);
  });

  test("throws on schema mismatch", () => {
    writeConfig({ mcpServers: { bad: { command: 42 } } });
    expect(() => loadMcpConfig()).toThrow(/Invalid/);
  });
});

describe("connectMcpServers", () => {
  test("connects to a real stdio server and discovers its tools", async () => {
    writeConfig({
      mcpServers: {
        mock: { command: "bun", args: ["run", MOCK_SERVER_SCRIPT] },
      },
    });
    const config = loadMcpConfig()!;
    const result = await connectMcpServers(config);

    expect(result.failures).toEqual([]);
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toContain("mcp__mock__echo");
    expect(names).toContain("mcp__mock__fail");
    expect(result.tools.find((t) => t.name === "mcp__mock__echo")?.description).toMatch(/echo/i);
  });

  test("returns failure (not rejection) when a server command does not exist", async () => {
    writeConfig({
      mcpServers: {
        bogus: {
          command: "definitely-not-a-real-binary-xyz123",
          args: [],
        },
      },
    });
    const config = loadMcpConfig()!;
    const result = await connectMcpServers(config);

    expect(result.tools).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.server).toBe("bogus");
    expect(result.failures[0]?.reason).toBeTruthy();
  });

  test("one bad server does not prevent another from connecting", async () => {
    writeConfig({
      mcpServers: {
        good: { command: "bun", args: ["run", MOCK_SERVER_SCRIPT] },
        bad: { command: "definitely-not-a-real-binary-xyz123", args: [] },
      },
    });
    const config = loadMcpConfig()!;
    const result = await connectMcpServers(config);

    expect(result.tools.some((t) => t.name.startsWith("mcp__good__"))).toBe(true);
    expect(result.failures.some((f) => f.server === "bad")).toBe(true);
  });

  test("getMcpToolsForRequest returns the same tools as connectMcpServers", async () => {
    writeConfig({
      mcpServers: {
        mock: { command: "bun", args: ["run", MOCK_SERVER_SCRIPT] },
      },
    });
    const config = loadMcpConfig()!;
    const { tools } = await connectMcpServers(config);
    expect(getMcpToolsForRequest()).toEqual(tools);
  });
});

describe("callMcpTool", () => {
  test("calls a connected tool and returns its result", async () => {
    writeConfig({
      mcpServers: {
        mock: { command: "bun", args: ["run", MOCK_SERVER_SCRIPT] },
      },
    });
    const config = loadMcpConfig()!;
    await connectMcpServers(config);

    const result = (await callMcpTool("mcp__mock__echo", { text: "hi" })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toBe("hi");
  });

  test("throws on an invalid name", () => {
    expect(() => callMcpTool("not-mcp-prefix", {})).toThrow(/Invalid MCP tool name/);
  });

  test("throws when the server is not connected", () => {
    expect(() => callMcpTool("mcp__unknown__tool", {})).toThrow(/not connected/);
  });
});