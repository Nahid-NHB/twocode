import type { SupportedProvider } from "@twocode/shared";

export type ValidationResult = { valid: true } | { valid: false; error: string };

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    // Ignore invalid/non-JSON error bodies and fall back below.
  }
  return res.statusText || `Request failed with status ${res.status}`;
}

// One real, cheap, read-only endpoint per provider -- listing available
// models (or, for OpenRouter, its key-info endpoint) is the standard
// lightweight way to confirm a key is accepted without spending anything
// on an actual completion.
const VALIDATION_REQUESTS: Record<SupportedProvider, (apiKey: string) => Request> = {
  anthropic: (apiKey) =>
    new Request("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    }),
  google: (apiKey) =>
    new Request(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    ),
  openai: (apiKey) =>
    new Request("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${apiKey}` },
    }),
  openrouter: (apiKey) =>
    new Request("https://openrouter.ai/api/v1/auth/key", {
      headers: { authorization: `Bearer ${apiKey}` },
    }),
};

export async function validateApiKey(provider: SupportedProvider, apiKey: string): Promise<ValidationResult> {
  const buildRequest = VALIDATION_REQUESTS[provider];

  try {
    const res = await fetch(buildRequest(apiKey));
    if (res.ok) return { valid: true };
    return { valid: false, error: await extractErrorMessage(res) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}
