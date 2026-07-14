import { TextAttributes } from "@opentui/core";
import { DEFAULT_CHAT_MODEL_ID } from "@twocode/shared";

export function StatusBar() {
  return (
    <box flexDirection="row" gap={1}>
      <text fg="cyan">Build</text>
      <text attributes={TextAttributes.DIM} fg="gray">
        ›
      </text>
      <text>{DEFAULT_CHAT_MODEL_ID}</text>
    </box>
  );
}
