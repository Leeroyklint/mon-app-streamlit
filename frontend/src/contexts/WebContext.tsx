import React, { createContext, useContext, useState } from "react";

const Ctx = createContext<{ web:boolean; toggle:()=>void }>({ web:false, toggle:()=>{} });

export const WebProvider:React.FC<{children:React.ReactNode}> = ({children}) => {
  const [web,setWeb] = useState(false);
  return <Ctx.Provider value={{ web, toggle:()=>setWeb(p=>!p) }}>{children}</Ctx.Provider>;
};

export const useWeb = () => useContext(Ctx);
