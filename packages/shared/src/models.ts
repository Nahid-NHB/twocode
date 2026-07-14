export type SupportedProvider = "anthropic" | "google" | "openai" | "openrouter";

// The single source of truth for "which providers exist." Adding a new
// provider means adding one entry here (plus its AI SDK package and one
// resolver branch in the server's lib/models.ts) -- nothing else in the
// CLI or server should hardcode a provider list separately from this one.
export interface ProviderDefinition {
  id: SupportedProvider;
  label: string;
  keyLabel: string;
  keyHelpUrl: string;
  freeTier: boolean;
  allowsCustomModelId: boolean;
}

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyLabel: "Anthropic API key",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    freeTier: false,
    allowsCustomModelId: false,
  },
  {
    id: "google",
    label: "Google (Gemini)",
    keyLabel: "Google AI API key",
    keyHelpUrl: "https://aistudio.google.com/apikey",
    freeTier: true,
    allowsCustomModelId: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    keyLabel: "OpenAI API key",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    freeTier: false,
    allowsCustomModelId: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyLabel: "OpenRouter API key",
    keyHelpUrl: "https://openrouter.ai/settings/keys",
    freeTier: true,
    allowsCustomModelId: true,
  },
] as const;

export function findProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export interface ModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface SupportedChatModelDefinition {
  id: string;
  provider: SupportedProvider;
  pricing: ModelPricing;
  free?: boolean;
}

// Pricing figures below are placeholders, not verified against each
// provider's current pricing page. Confirm real numbers before Phase I
// (billing) uses them to compute actual credit charges.
export const SUPPORTED_CHAT_MODELS = [
  // Anthropic
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
  // Google -- Gemini's free tier (aistudio.google.com, no card required) is
  // exactly the entry point this project wants to make easy to reach.
  // Confirmed against Google's own pricing docs (ai.google.dev/gemini-api/docs/pricing):
  // Flash and Flash-Lite have a real free tier; Pro requires a billing-enabled
  // project with no free tier at all -- selecting it with a free-tier-only key
  // fails with a real, confusing API error, so it's deliberately NOT flagged
  // free here and the models dialog surfaces that distinction to the user
  // before they pick it, not after.
  {
    id: "gemini-2.5-flash",
    provider: "google",
    pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
    free: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    provider: "google",
    pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
    free: true,
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    pricing: { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10 },
  },
  // OpenAI
  {
    id: "gpt-5.1",
    provider: "openai",
    pricing: { inputUsdPerMillionTokens: 5, outputUsdPerMillionTokens: 15 },
  },
  {
    id: "gpt-5.1-mini",
    provider: "openai",
    pricing: { inputUsdPerMillionTokens: 0.6, outputUsdPerMillionTokens: 2.4 },
  },
  // OpenRouter -- these ":free" slugs are OpenRouter's own free-tier model
  // routes (no cost, rate-limited). Curated as a starting point; the
  // provider also allows typing any other OpenRouter model slug directly
  // (see ProviderDefinition.allowsCustomModelId), since it proxies far more
  // models than are worth hardcoding here.
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    provider: "openrouter",
    pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
    free: true,
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    provider: "openrouter",
    pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
    free: true,
  },
  {
    id: "qwen/qwen-2.5-7b-instruct:free",
    provider: "openrouter",
    pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
    free: true,
  },
] as const satisfies readonly SupportedChatModelDefinition[];

export type CuratedChatModelId = (typeof SUPPORTED_CHAT_MODELS)[number]["id"];

// Loosened on purpose: OpenRouter accepts arbitrary model slugs beyond the
// curated list above, so the type that flows through requests/UI state
// can't be a closed literal union. `(string & {})` keeps autocomplete for
// the curated ids while still accepting any string at the type level.
export type SupportedChatModelId = CuratedChatModelId | (string & {});

export const DEFAULT_PROVIDER: SupportedProvider = "anthropic";
export const DEFAULT_CHAT_MODEL_ID: CuratedChatModelId = "claude-sonnet-5";

export function findSupportedChatModel(modelId: string): SupportedChatModelDefinition | undefined {
  return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId);
}

export function modelsForProvider(provider: SupportedProvider): SupportedChatModelDefinition[] {
  return SUPPORTED_CHAT_MODELS.filter((model) => model.provider === provider);
}

// First curated model for a provider -- used as the model a UI switches to
// when the user picks that provider, so there's always a valid selection.
export function defaultModelForProvider(provider: SupportedProvider): string {
  return modelsForProvider(provider)[0]?.id ?? "";
}

// A model id is valid for a request if it's in the curated list for that
// provider, or the provider explicitly allows arbitrary model ids
// (currently just OpenRouter).
export function isValidModelForProvider(provider: string, modelId: string): boolean {
  if (!modelId) return false;

  const providerDef = findProvider(provider);
  if (!providerDef) return false;

  if (providerDef.allowsCustomModelId) return true;

  const model = findSupportedChatModel(modelId);
  return model != null && model.provider === provider;
}
