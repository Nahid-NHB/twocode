import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Header } from "./components/header";
import { InputBar } from "./components/input-bar";
import { ThemedRoot } from "./layouts/themed-root";
import { KeyboardLayerProvider } from "./providers/keyboard-layer";
import { ThemeProvider } from "./providers/theme";

function App() {
  return (
    <ThemedRoot>
      <box alignItems="center" justifyContent="center" width="100%" height="100%" gap={2}>
        <Header />
        <box width="100%" maxWidth={78} paddingX={2}>
          <InputBar onSubmit={() => {}} />
        </box>
      </box>
    </ThemedRoot>
  );
}

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(
  <ThemeProvider>
    <KeyboardLayerProvider>
      <App />
    </KeyboardLayerProvider>
  </ThemeProvider>,
);
