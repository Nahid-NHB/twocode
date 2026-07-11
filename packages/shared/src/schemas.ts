import { tool } from "ai";
import { z } from "zod";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Path to the file to read, relative to the project root."),
  }),
  listDirectory: z.object({
    path: z
      .string()
      .default(".")
      .describe("Directory to list, relative to the project root."),
  }),
  glob: z.object({
    pattern: z
      .string()
      .describe('Glob pattern to match files against, e.g. "src/**/*.ts".'),
  }),
  grep: z.object({
    pattern: z.string().describe("Regular expression to search for."),
    path: z
      .string()
      .optional()
      .describe("Directory to search within; defaults to the project root."),
  }),
  writeFile: z.object({
    path: z.string().describe("Path to the file to write, relative to the project root."),
    content: z.string().describe("Full contents to write to the file."),
  }),
  editFile: z.object({
    path: z.string().describe("Path to the file to edit, relative to the project root."),
    oldString: z
      .string()
      .describe("Exact existing text to replace. Must match exactly once in the file."),
    newString: z.string().describe("Text to replace oldString with."),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to execute in the project root."),
  }),
} as const;

export type ToolInputSchemas = typeof toolInputSchemas;
export type ToolName = keyof ToolInputSchemas;

// These contracts deliberately have no `execute` function. The server only
// ever describes these tools to the model; actual execution happens inside
// the CLI, which is the only side with access to the user's local
// filesystem and shell.
export const readOnlyToolContracts = {
  readFile: tool({
    description: "Read the contents of a file.",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List the contents of a directory.",
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: "Find files matching a glob pattern.",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description: "Search file contents for a regular expression.",
    inputSchema: toolInputSchemas.grep,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Write full contents to a file, creating or overwriting it.",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description:
      "Replace an exact, unique occurrence of oldString with newString in a file.",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Run a shell command in the project root.",
    inputSchema: toolInputSchemas.bash,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(
  mode: ModeType,
): typeof readOnlyToolContracts | ToolContracts {
  return mode === Mode.PLAN ? readOnlyToolContracts : buildToolContracts;
}
