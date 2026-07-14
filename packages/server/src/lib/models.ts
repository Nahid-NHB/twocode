import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isValidModelForProvider, type SupportedProvider } from "@twocode/shared";
import type { LanguageModel } from "ai";

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider;
  modelId: string;
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

// One branch per provider in @twocode/shared's PROVIDERS list. Adding a
// new provider means: one new PROVIDERS entry (shared), one new AI SDK
// package (here), and one new case below -- nothing else changes.
function createModel(provider: SupportedProvider, modelId: string, apiKey: string): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
    default:
      return assertUnsupportedProvider(provider);
  }
}

export function resolveChatModel(provider: string, modelId: string, apiKey: string): ResolvedModel {
  if (!isValidModelForProvider(provider, modelId)) {
    throw new Error(`Unsupported model "${modelId}" for provider "${provider}"`);
  }

  return {
    model: createModel(provider as SupportedProvider, modelId, apiKey),
    provider: provider as SupportedProvider,
    modelId,
  };
}
