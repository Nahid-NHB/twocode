import { useMemo } from "react";
import { TextAttributes } from "@opentui/core";
import { useDialog } from "../../providers/dialog";
import { getMcpServerStatus } from "../../lib/mcp-servers";
import { DialogSearchList } from "../dialog-search-list";

type ServerEntry =
  | { name: string; status: "connected"; toolCount: number }
  | { name: string; status: "failed"; reason: string }
  | { name: string; status: "configured"; toolCount: 0 };

export function McpDialogContent() {
  const dialog = useDialog();
  const servers = useMemo<ServerEntry[]>(() => getMcpServerStatus() as ServerEntry[], []);

  if (servers.length === 0) {
    return (
      <box flexDirection="column">
        <text>No MCP servers configured.</text>
        <text attributes={TextAttributes.DIM}>
          Add a server to ~/.twocode/mcp.json and restart the CLI.
        </text>
        <text attributes={TextAttributes.DIM}>Press Esc to close.</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={1}>
      <DialogSearchList
        items={servers}
        onSelect={() => dialog.close()}
        filterFn={(s, q) => s.name.toLowerCase().includes(q.toLowerCase())}
        renderItem={(s, isSelected) => {
          const statusText =
            s.status === "connected"
              ? `connected · ${s.toolCount} tool${s.toolCount === 1 ? "" : "s"}`
              : s.status === "failed"
                ? `failed: ${s.reason}`
                : "configured";
          return (
            <>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                {s.name}
              </text>
              <box flexGrow={1} />
              <text
                selectable={false}
                fg={isSelected ? "black" : undefined}
                attributes={TextAttributes.DIM}
              >
                {statusText}
              </text>
            </>
          );
        }}
        getKey={(s) => s.name}
        placeholder="Search servers"
        emptyText="No matching servers"
      />
      <text attributes={TextAttributes.DIM}>
        Edit ~/.twocode/mcp.json and restart the CLI to add/remove servers.
      </text>
    </box>
  );
}
