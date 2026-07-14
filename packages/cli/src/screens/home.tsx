import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";

export function Home() {
  return (
    <box alignItems="center" justifyContent="center" width="100%" height="100%" gap={2}>
      <Header />
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar onSubmit={() => {}} />
      </box>
    </box>
  );
}
