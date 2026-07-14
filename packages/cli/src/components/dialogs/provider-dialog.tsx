import { useCallback, useRef, useState } from "react";
import { TextAttributes, type InputRenderable } from "@opentui/core";
import { PROVIDERS, type ProviderDefinition, type SupportedProvider } from "@twocode/shared";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { useToast } from "../../providers/toast";
import { getApiKey, saveApiKey, listConfiguredProviders } from "../../lib/credentials";
import { validateApiKey } from "../../lib/validate-provider-key";
import { DialogSearchList } from "../dialog-search-list";

type Step =
  | { name: "pick" }
  | { name: "enter-key"; provider: ProviderDefinition; editing: boolean; error?: string }
  | { name: "validating"; provider: ProviderDefinition; editing: boolean };

type ProviderDialogContentProps = {
  currentProvider: SupportedProvider;
  onSelectProvider: (provider: SupportedProvider) => void;
};

export function ProviderDialogContent({ currentProvider, onSelectProvider }: ProviderDialogContentProps) {
  const dialog = useDialog();
  const toast = useToast();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>({ name: "pick" });
  const [configured, setConfigured] = useState(() => new Set(listConfiguredProviders()));
  const keyInputRef = useRef<InputRenderable>(null);

  const activateProvider = useCallback(
    (provider: SupportedProvider) => {
      onSelectProvider(provider);
      dialog.close();
    },
    [onSelectProvider, dialog],
  );

  const handlePick = useCallback(
    (provider: ProviderDefinition) => {
      if (getApiKey(provider.id)) {
        activateProvider(provider.id);
        return;
      }
      setStep({ name: "enter-key", provider, editing: false });
    },
    [activateProvider],
  );

  const handleEditKey = useCallback((provider: ProviderDefinition) => {
    setStep({ name: "enter-key", provider, editing: true });
  }, []);

  const handleKeySubmit = useCallback(
    async (provider: ProviderDefinition, apiKey: string, wasAlreadyConfigured: boolean) => {
      const trimmed = apiKey.trim();
      if (!trimmed) return;

      setStep({ name: "validating", provider, editing: wasAlreadyConfigured });
      const result = await validateApiKey(provider.id, trimmed);

      if (!result.valid) {
        setStep({ name: "enter-key", provider, editing: wasAlreadyConfigured, error: result.error });
        return;
      }

      saveApiKey(provider.id, trimmed);
      setConfigured((prev) => new Set(prev).add(provider.id));
      toast.show({
        variant: "success",
        message: `${provider.label} key ${wasAlreadyConfigured ? "updated" : "saved"} and verified.`,
      });

      // Switching providers resets the active model to that provider's
      // default (see PromptConfigProvider) -- skip that reset when the key
      // just being updated already belongs to the provider that's active.
      if (provider.id === currentProvider) {
        dialog.close();
      } else {
        activateProvider(provider.id);
      }
    },
    [activateProvider, currentProvider, dialog, toast],
  );

  if (step.name === "enter-key" || step.name === "validating") {
    const { provider, editing } = step;
    const validating = step.name === "validating";
    const wasAlreadyConfigured = configured.has(provider.id);

    return (
      <box flexDirection="column" gap={1}>
        <text>
          {editing
            ? `Update the API key for ${provider.label}.`
            : `${provider.label} needs an API key${provider.freeTier ? " (free tier available)" : ""}.`}
        </text>
        <text attributes={TextAttributes.DIM}>Get one: {provider.keyHelpUrl}</text>
        {step.name === "enter-key" && step.error ? <text fg={colors.error}>{step.error}</text> : null}
        <input
          ref={keyInputRef}
          placeholder="Paste your API key and press enter"
          focused={!validating}
          onSubmit={() => {
            void handleKeySubmit(provider, keyInputRef.current?.value ?? "", wasAlreadyConfigured);
          }}
        />
        {validating ? <text attributes={TextAttributes.DIM}>Validating key…</text> : null}
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={1}>
      <DialogSearchList
        items={[...PROVIDERS]}
        onSelect={handlePick}
        onSecondaryAction={handleEditKey}
        filterFn={(p, query) => p.label.toLowerCase().includes(query.toLowerCase())}
        renderItem={(p, isSelected) => (
          <>
            <text selectable={false} fg={isSelected ? "black" : "white"}>
              {p.id === currentProvider ? " • " : "   "}
              {p.label}
            </text>
            <box flexGrow={1} />
            <text selectable={false} fg={isSelected ? "black" : undefined} attributes={TextAttributes.DIM}>
              {configured.has(p.id) ? "configured" : p.freeTier ? "free tier" : ""}
            </text>
          </>
        )}
        getKey={(p) => p.id}
        placeholder="Search providers"
        emptyText="No matching providers"
      />
      <text attributes={TextAttributes.DIM}>enter: select · shift+enter: change key</text>
    </box>
  );
}
