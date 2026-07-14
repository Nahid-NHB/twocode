import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
import { usePromptConfig } from "../providers/prompt-config";

export function Home() {
  const navigate = useNavigate();
  const { mode, provider, model } = usePromptConfig();

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/sessions/new", { state: { message: text, mode, provider, model } });
    },
    [navigate, mode, provider, model],
  );

  return (
    <box alignItems="center" justifyContent="center" width="100%" height="100%" gap={2}>
      <Header />
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar onSubmit={handleSubmit} />
      </box>
    </box>
  );
}
