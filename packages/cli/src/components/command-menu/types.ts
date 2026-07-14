import type { DialogContextValue } from "../../providers/dialog";

export type CommandContext = {
  exit: () => void;
  dialog: DialogContextValue;
};

export type Command = {
  name: string;
  description: string;
  value: string;
  action?: (ctx: CommandContext) => void | Promise<void>;
};
