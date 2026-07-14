import { modelsForProvider } from "@twocode/shared";
import { AgentsDialogContent } from "../dialogs/agents-dialog";
import { ModelsDialogContent } from "../dialogs/models-dialog";
import { ProviderDialogContent } from "../dialogs/provider-dialog";
import { SessionsDialogContent } from "../dialogs/sessions-dialog";
import { ThemeDialogContent } from "../dialogs/theme-dialog";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    },
  },
  {
    name: "provider",
    description: "Switch AI provider (Anthropic, Gemini, OpenAI, OpenRouter...)",
    value: "/provider",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Provider",
        children: <ProviderDialogContent currentProvider={ctx.provider} onSelectProvider={ctx.setProvider} />,
      });
    },
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Agent",
        children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />,
      });
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Model",
        children: (
          <ModelsDialogContent
            currentModel={ctx.model}
            models={modelsForProvider(ctx.provider).map((model) => model.id)}
            onSelectModel={ctx.setModel}
          />
        ),
      });
    },
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Sessions",
        children: <SessionsDialogContent />,
      });
    },
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialogContent />,
      });
    },
  },
  {
    name: "login",
    description: "Sign in with your browser",
    value: "/login",
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "Sign-in isn't available yet — this needs a real Clerk OAuth app (Phase H).",
      });
    },
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "There's no real session to sign out of yet — auth is still the dev-user stub (Phase H).",
      });
    },
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "Buying credits isn't available yet — this needs a real Polar account (Phase I).",
      });
    },
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
    action: (ctx) => {
      ctx.toast.show({
        variant: "info",
        message: "There's no billing portal yet — credits are still the always-pass stub (Phase I).",
      });
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];
