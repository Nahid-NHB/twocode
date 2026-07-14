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
  | { name: "enter-key"; provider: ProviderDefinition; error?: string }
  | { name: "validating"; provider: ProviderDefinition };

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
      setStep({ name: "enter-key", provider });
    },
    [activateProvider],
  );

  const handleKeySubmit = useCallback(
    async (provider: ProviderDefinition, apiKey: string) => {
      const trimmed = apiKey.trim();
      if (!trimmed) return;

      setStep({ name: "validating", provider });
      const result = await validateApiKey(provider.id, trimmed);

      if (!result.valid) {
        setStep({ name: "enter-key", provider, error: result.error });
        return;
      }

      saveApiKey(provider.id, trimmed);
      setConfigured((prev) => new Set(prev).add(provider.id));
      toast.show({ variant: "success", message: `${provider.label} key saved and verified.` });
      activateProvider(provider.id);
    },
    [activateProvider, toast],
  );

  if (step.name === "enter-key" || step.name === "validating") {
    const { provider } = step;
    const validating = step.name === "validating";

    return (
      <box flexDirection="column" gap={1}>
        <text>
          {provider.label} needs an API key{provider.freeTier ? " (free tier available)" : ""}.
        </text>
        <text attributes={TextAttributes.DIM}>Get one: {provider.keyHelpUrl}</text>
        {step.name === "enter-key" && step.error ? (
          <text fg={colors.error}>{step.error}</text>
        ) : null}
        <input
          ref={keyInputRef}
          placeholder="Paste your API key and press enter"
          focused={!validating}
          onSubmit={() => {
            void handleKeySubmit(provider, keyInputRef.current?.value ?? "");
          }}
        />
        {validating ? <text attributes={TextAttributes.DIM}>Validating key…</text> : null}
      </box>
    );
  }

  return (
    <DialogSearchList
      items={[...PROVIDERS]}
      onSelect={handlePick}
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
  );
}
