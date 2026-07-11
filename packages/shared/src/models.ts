export type SupportedProvider = "anthropic" | "openai";

export interface ModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface SupportedChatModelDefinition {
  id: string;
  provider: SupportedProvider;
  pricing: ModelPricing;
}

// Pricing figures below are placeholders, not verified against Anthropic's
// current pricing page. Confirm real numbers before Phase I (billing) uses
// them to compute actual credit charges.
export const SUPPORTED_CHAT_MODELS = [
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    pricing: { inputUsdPerMillionTokens: 15, outputUsdPerMillionTokens: 75 },
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    pricing: { inputUsdPerMillionTokens: 3, outputUsdPerMillionTokens: 15 },
  },
  {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    pricing: { inputUsdPerMillionTokens: 0.8, outputUsdPerMillionTokens: 4 },
  },
] as const satisfies readonly SupportedChatModelDefinition[];

export type SupportedChatModelId = (typeof SUPPORTED_CHAT_MODELS)[number]["id"];

export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId = "claude-sonnet-5";

export function findSupportedChatModel(
  modelId: string,
): SupportedChatModelDefinition | undefined {
  return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId);
}
