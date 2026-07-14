import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_PROVIDER,
  defaultModelForProvider,
  Mode,
  type ModeType,
  type SupportedChatModelId,
  type SupportedProvider,
} from "@twocode/shared";
import { listConfiguredProviders } from "../../lib/credentials";

type PromptConfigContextValue = {
  mode: ModeType;
  toggleMode: () => void;
  setMode: (mode: ModeType) => void;
  provider: SupportedProvider;
  setProvider: (provider: SupportedProvider) => void;
  model: SupportedChatModelId;
  setModel: (model: SupportedChatModelId) => void;
};

const PromptConfigContext = createContext<PromptConfigContextValue | null>(null);

export function usePromptConfig(): PromptConfigContextValue {
  const value = useContext(PromptConfigContext);
  if (!value) {
    throw new Error("usePromptConfig must be used within a PromptConfigProvider");
  }
  return value;
}

// A returning user who has already configured a provider should land on
// it, not always default back to Anthropic.
function getInitialProvider(): SupportedProvider {
  return listConfiguredProviders()[0] ?? DEFAULT_PROVIDER;
}

type PromptConfigProviderProps = {
  children: ReactNode;
};

export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const [mode, setMode] = useState<ModeType>(Mode.BUILD);
  const [provider, setProviderState] = useState<SupportedProvider>(getInitialProvider);
  const [model, setModel] = useState<SupportedChatModelId>(() => {
    const initialProvider = getInitialProvider();
    return initialProvider === DEFAULT_PROVIDER ? DEFAULT_CHAT_MODEL_ID : defaultModelForProvider(initialProvider);
  });

  const toggleMode = useCallback(() => {
    setMode((m) => (m === Mode.BUILD ? Mode.PLAN : Mode.BUILD));
  }, []);

  // Switching providers resets the model to that provider's default --
  // the previous model almost certainly isn't valid for the new provider.
  const setProvider = useCallback((nextProvider: SupportedProvider) => {
    setProviderState(nextProvider);
    setModel(defaultModelForProvider(nextProvider));
  }, []);

  return (
    <PromptConfigContext.Provider
      value={{ mode, toggleMode, setMode, provider, setProvider, model, setModel }}
    >
      {children}
    </PromptConfigContext.Provider>
  );
}
