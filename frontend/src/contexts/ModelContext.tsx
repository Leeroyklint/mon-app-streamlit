import React, { createContext, useContext, useState } from "react";

export type ModelId = string;

interface ModelCtx {
  modelId: ModelId;
  setModelId: (id: ModelId) => void;
}

const Ctx = createContext<ModelCtx | null>(null);

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modelId, setModelId] = useState<ModelId>("GPT 4o");
  return <Ctx.Provider value={{ modelId, setModelId }}>{children}</Ctx.Provider>;
};

export const useModel = (): ModelCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useModel doit être utilisé dans <ModelProvider>");
  return c;
};
