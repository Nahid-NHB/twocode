import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SupportedProvider } from "@twocode/shared";

const CONFIG_DIR = join(homedir(), ".twocode");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

type CredentialsFile = Partial<Record<SupportedProvider, string>>;

function readCredentialsFile(): CredentialsFile {
  try {
    const raw = readFileSync(CREDENTIALS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" ? (parsed as CredentialsFile) : {};
  } catch {
    return {};
  }
}

export function getApiKey(provider: SupportedProvider): string | undefined {
  return readCredentialsFile()[provider];
}

export function listConfiguredProviders(): SupportedProvider[] {
  return Object.keys(readCredentialsFile()) as SupportedProvider[];
}

export function saveApiKey(provider: SupportedProvider, apiKey: string): void {
  const credentials = readCredentialsFile();
  credentials[provider] = apiKey;

  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function deleteApiKey(provider: SupportedProvider): void {
  const credentials = readCredentialsFile();
  if (!(provider in credentials)) return;

  delete credentials[provider];

  if (Object.keys(credentials).length === 0) {
    try {
      unlinkSync(CREDENTIALS_PATH);
    } catch {
      // Already gone -- nothing to clean up.
    }
    return;
  }

  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}
