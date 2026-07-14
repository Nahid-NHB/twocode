import type { ModeType, SupportedChatModelId } from "@twocode/shared";
import type { DialogContextValue } from "../../providers/dialog";

export type CommandContext = {
  exit: () => void;
  dialog: DialogContextValue;
  mode: ModeType;
  setMode: (mode: ModeType) => void;
  model: SupportedChatModelId;
  setModel: (model: SupportedChatModelId) => void;
};

export type Command = {
  name: string;
  description: string;
  value: string;
  action?: (ctx: CommandContext) => void | Promise<void>;
};
