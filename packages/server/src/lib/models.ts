import { anthropic } from "@ai-sdk/anthropic";
import { findSupportedChatModel, type SupportedChatModelId } from "@twocode/shared";
import type { LanguageModel } from "ai";

export type ResolvedModel = {
  model: LanguageModel;
  modelId: SupportedChatModelId;
};

export function isSupportedChatModel(modelId: string): modelId is SupportedChatModelId {
  return findSupportedChatModel(modelId) != null;
}

export function resolveChatModel(modelId: string): ResolvedModel {
  const model = findSupportedChatModel(modelId);
  if (!model) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  return { model: anthropic(model.id), modelId: model.id as SupportedChatModelId };
}
