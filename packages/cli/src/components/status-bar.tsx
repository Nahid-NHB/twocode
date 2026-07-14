import { TextAttributes } from "@opentui/core";
import { findProvider, Mode } from "@twocode/shared";
import { usePromptConfig } from "../providers/prompt-config";
import { useTheme } from "../providers/theme";

export function StatusBar() {
  const { mode, provider, model } = usePromptConfig();
  const { colors } = useTheme();
  const providerLabel = findProvider(provider)?.label ?? provider;

  return (
    <box flexDirection="row" gap={1}>
      <text fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>
        {mode === Mode.PLAN ? "Plan" : "Build"}
      </text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        ›
      </text>
      <text fg={colors.info}>{providerLabel}</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        ›
      </text>
      <text>{model}</text>
    </box>
  );
}
