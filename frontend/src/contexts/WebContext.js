import React, { createContext, useContext, useState } from "react";
const Ctx = createContext({ web: false, toggle: () => { } });
export const WebProvider = ({ children }) => {
    const [web, setWeb] = useState(false);
    return React.createElement(Ctx.Provider, { value: { web, toggle: () => setWeb(p => !p) } }, children);
};
export const useWeb = () => useContext(Ctx);
