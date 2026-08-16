import { useEffect } from "react";
import { Outlet } from "react-router";
import { isDockerAvailable, reapOrphans } from "@twocode/sandbox";
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

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DockerStartupCheck />
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
