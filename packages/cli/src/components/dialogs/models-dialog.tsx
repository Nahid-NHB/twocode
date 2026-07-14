import { useCallback } from "react";
import { TextAttributes } from "@opentui/core";
import { findProvider, type SupportedChatModelDefinition, type SupportedChatModelId } from "@twocode/shared";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";

type ModelsDialogContentProps = {
  currentModel: SupportedChatModelId;
  models: SupportedChatModelDefinition[];
  onSelectModel: (modelId: SupportedChatModelId) => void;
};

export function ModelsDialogContent({ currentModel, models, onSelectModel }: ModelsDialogContentProps) {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (model: SupportedChatModelDefinition) => {
      onSelectModel(model.id);
      dialog.close();
    },
    [dialog, onSelectModel],
  );

  return (
    <DialogSearchList
      items={models}
      onSelect={handleSelect}
      filterFn={(model, query) => model.id.toLowerCase().includes(query.toLowerCase())}
      renderItem={(model, isSelected) => {
        // Only worth flagging when the provider actually has a free tier --
        // otherwise every single model would show "requires billing", which
        // is just noise (the provider itself already isn't free).
        const providerHasFreeTier = findProvider(model.provider)?.freeTier ?? false;
        const badge = model.free ? "free" : providerHasFreeTier ? "requires billing" : "";

        return (
          <>
            <text selectable={false} fg={isSelected ? "black" : "white"}>
              {model.id === currentModel ? " • " : "   "}
              {model.id}
            </text>
            <box flexGrow={1} />
            <text selectable={false} fg={isSelected ? "black" : undefined} attributes={TextAttributes.DIM}>
              {badge}
            </text>
          </>
        );
      }}
      getKey={(model) => model.id}
      placeholder="Search models"
      emptyText="No matching models"
    />
  );
}
