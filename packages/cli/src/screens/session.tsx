import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { type ModeType, type SupportedChatModelId } from "@twocode/shared";
import type { InferResponseType } from "hono/client";
import { SessionShell } from "../components/session-shell";
import { UserMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { usePromptConfig } from "../providers/prompt-config";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { useChat } from "../hooks/use-chat";
import type { Message } from "../hooks/use-chat";

type SessionData = InferResponseType<(typeof apiClient.sessions)[":id"]["$get"], 200>;

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>((val) => val != null && typeof val === "object" && "id" in val),
  initialPrompt: z
    .object({
      message: z.string(),
      mode: z.custom<ModeType>(),
      model: z.custom<SupportedChatModelId>(),
    })
    .optional(),
});

// Bot replies aren't rendered yet -- without a real model API key there's
// no real streamed response to build that rendering against, and guessing
// at a shape (tool-call UI, streaming cursor) risks getting it wrong. User
// messages and the real error path (surfaced via ErrorMessage) are enough
// to prove the chat pipeline itself works end to end.
function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role !== "user") return null;

  const text = msg.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  return <UserMessage message={text} mode={msg.metadata?.mode ?? "BUILD"} />;
}

function SessionChat({
  session,
  initialPrompt,
}: {
  session: SessionData;
  initialPrompt?: { message: string; mode: ModeType; model: SupportedChatModelId };
}) {
  const [initialMessages] = useState(() => session.messages as unknown as Message[]);
  const { mode, model } = usePromptConfig();
  const { messages, status, submit, abort, error } = useChat(session.id, initialMessages);
  const hasSubmittedInitialPromptRef = useRef(false);

  useEffect(() => {
    return () => {
      void abort();
    };
  }, [abort]);

  useEffect(() => {
    if (!initialPrompt || hasSubmittedInitialPromptRef.current) return;
    hasSubmittedInitialPromptRef.current = true;
    void submit({ userText: initialPrompt.message, mode: initialPrompt.mode, model: initialPrompt.model });
  }, [initialPrompt, submit]);

  return (
    <SessionShell
      onSubmit={(text) => submit({ userText: text, mode, model })}
      loading={status === "submitted" || status === "streaming"}
      interruptible={status === "submitted" || status === "streaming"}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {error && <ErrorMessage message={error.message} />}
    </SessionShell>
  );
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(prefetched?.session ?? null);

  useEffect(() => {
    // Skip fetch if session was passed via location state
    if (prefetched?.session) return;

    setSession(null);

    if (!id) return;

    let ignore = false;
    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[":id"].$get({ param: { id } });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const resolved = await res.json();
        setSession(resolved);
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: err instanceof Error ? err.message : "Failed to load session",
        });
        navigate("/", { replace: true });
      }
    };

    fetchSession();
    return () => {
      ignore = true;
    };
  }, [id, prefetched, toast, navigate]);

  if (!session) {
    return <SessionShell onSubmit={() => {}} inputDisabled loading />;
  }

  return <SessionChat key={session.id} session={session} initialPrompt={prefetched?.initialPrompt} />;
}
