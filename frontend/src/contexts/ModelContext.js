import React, { createContext, useContext, useState } from "react";
const Ctx = createContext(null);
export const ModelProvider = ({ children }) => {
    const [modelId, setModelId] = useState("GPT 4o");
    return React.createElement(Ctx.Provider, { value: { modelId, setModelId } }, children);
};
export const useModel = () => {
    const c = useContext(Ctx);
    if (!c)
        throw new Error("useModel doit être utilisé dans <ModelProvider>");
    return c;
};
