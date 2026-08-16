import { useEffect } from "react";
import { Outlet } from "react-router";
import { isDockerAvailable, reapOrphans } from "@twocode/sandbox";
import { connectMcpServers, loadMcpConfig } from "../lib/mcp-servers";
import { DialogProvider } from "../providers/dialog";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { PromptConfigProvider } from "../providers/prompt-config";
import { ThemeProvider } from "../providers/theme";
import { ToastProvider, useToast } from "../providers/toast";
import { ThemedRoot } from "./themed-root";

function DockerStartupCheck() {
  const { show } = useToast();
  useEffect(() => {
    isDockerAvailable().then((available) => {
      if (!available) {
        show({
          message:
            "Docker unavailable — bash tool disabled. Start Docker to enable it.",
          variant: "error",
          duration: 8000,
        });
        return;
      }
      reapOrphans().catch(() => {
        // Best-effort cleanup — a failed sweep shouldn't block startup.
      });
    });
  }, []);
  return null;
}

function McpStartupCheck() {
  const { show } = useToast();
  useEffect(() => {
    let config;
    try {
      config = loadMcpConfig();
    } catch (error) {
      show({
        message: `Failed to parse ~/.twocode/mcp.json — MCP servers disabled. ${error instanceof Error ? error.message : String(error)}`,
        variant: "error",
        duration: 8000,
      });
      return;
    }
    if (!config) return;

    connectMcpServers(config).then((result) => {
      for (const failure of result.failures) {
        show({
          message: `MCP server '${failure.server}' failed to start: ${failure.reason}`,
          variant: "error",
          duration: 8000,
        });
      }
    });
  }, []);
  return null;
}

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DockerStartupCheck />
        <McpStartupCheck />
        <KeyboardLayerProvider>
          <DialogProvider>
            <PromptConfigProvider>
              <ThemedRoot>
                <Outlet />
              </ThemedRoot>
            </PromptConfigProvider>
          </DialogProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
