import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type InferUITools,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { db } from "@twocode/database/client";
import type { Prisma } from "@twocode/database";
import {
  getToolContracts,
  isValidModelForProvider,
  modeSchema,
  PROVIDERS,
  type ModeType,
  type SupportedProvider,
  type ToolContracts,
} from "@twocode/shared";
import { buildSystemPrompt } from "../system-prompt";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireAuth } from "../middleware/require-auth";
import { requireCreditsBalance } from "../middleware/require-credits-balance";
import { resolveChatModel } from "../lib/models";

type ChatMessageMetadata = {
  mode?: ModeType;
  provider?: SupportedProvider;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type TwoCodeUIMessage = UIMessage<ChatMessageMetadata, never, InferUITools<ToolContracts>>;

const providerIds = PROVIDERS.map((p) => p.id) as [SupportedProvider, ...SupportedProvider[]];

// apiKey is intentionally never persisted anywhere -- it's read here, used
// once to build a single AI SDK model instance for this request, and
// discarded. Nothing downstream (session.messages, logs) should ever see it.
const submitSchema = z
  .object({
    id: z.string(),
    messages: z
      .array(
        z.custom<TwoCodeUIMessage>((value) => {
          return value != null && typeof value === "object" && "id" in value && "parts" in value;
        }),
      )
      .min(1),
    mode: modeSchema,
    provider: z.enum(providerIds),
    model: z.string().min(1),
    apiKey: z.string().min(1),
  })
  .refine((data) => isValidModelForProvider(data.provider, data.model), {
    message: "Unsupported model for provider",
    path: ["model"],
  });

function hasPendingToolCalls(message: TwoCodeUIMessage) {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const state = (part as { state?: string }).state;
      return state !== "output-available" && state !== "output-error";
    }

    return false;
  });
}

export const chatRoute = new Hono<AuthenticatedEnv>().post(
  "/",
  requireAuth,
  requireCreditsBalance,
  zValidator("json", submitSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  }),
  async (c) => {
    const userId = c.get("userId");
    const { id, messages, mode, provider, model, apiKey } = c.req.valid("json");

    const session = await db.session.findFirst({
      where: { id, userId },
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const startTime = Date.now();
    const tools = getToolContracts(mode);
    const resolvedModel = resolveChatModel(provider, model, apiKey);
    const previousMessages = Array.isArray(session.messages)
      ? (session.messages as unknown as TwoCodeUIMessage[])
      : [];
    const mergedMessages = [...previousMessages];

    for (const message of messages) {
      const incomingMessage = {
        ...message,
        metadata: { ...message.metadata, mode, provider, model },
      } satisfies TwoCodeUIMessage;

      const existingMessageIndex = mergedMessages.findIndex((m) => m.id === incomingMessage.id);

      if (existingMessageIndex === -1) {
        mergedMessages.push(incomingMessage);
      } else {
        mergedMessages[existingMessageIndex] = incomingMessage;
      }
    }

    const nextMessages = await validateUIMessages<TwoCodeUIMessage>({
      messages: mergedMessages,
      tools,
    });
    const modelMessages = await convertToModelMessages(nextMessages, { tools });
    let completedUsage: LanguageModelUsage | null = null;

    const result = streamText({
      model: resolvedModel.model,
      system: buildSystemPrompt({ mode }),
      messages: modelMessages,
      tools,
      onFinish(event) {
        completedUsage = event.totalUsage;
      },
    });

    return result.toUIMessageStreamResponse<TwoCodeUIMessage>({
      originalMessages: nextMessages,
      messageMetadata({ part }) {
        if (part.type === "start") {
          return { mode, provider, model };
        }

        if (part.type !== "finish") return undefined;

        return {
          mode,
          provider,
          model,
          durationMs: Date.now() - startTime,
          ...(completedUsage ? { usage: completedUsage } : {}),
        };
      },
      async onFinish(event) {
        if (event.isAborted) return;
        if (hasPendingToolCalls(event.responseMessage)) return;

        await db.session.update({
          where: { id, userId },
          data: {
            messages: event.messages as unknown as Prisma.InputJsonValue,
          },
        });
      },
      onError(error) {
        return error instanceof Error ? error.message : String(error);
      },
    });
  },
);
