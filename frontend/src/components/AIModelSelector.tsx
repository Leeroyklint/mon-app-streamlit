import React, { useEffect, useRef, useState } from "react";
import { selectModel } from "../services/modelService";
import "./AIModelSelector.css";

export interface LlmModel {
  id: string;
  name: string;
  subtitle: string;
}

interface Props {
  models: LlmModel[];
}

const AIModelSelector: React.FC<Props> = ({ models }) => {
  const defaultId   = models[0]?.id ?? "";
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState(defaultId);
  const ref = useRef<HTMLDivElement>(null);

  /* --- click hors composant -> referme --------------------------- */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  /* --- mise à jour backend -------------------------------------- */
  useEffect(() => {
    if (selected) selectModel(selected).catch(console.error);
  }, [selected]);

  /* --- helpers --------------------------------------------------- */
  const current = models.find(m => m.id === selected);

  const choose = (id: string) => {
    setSelected(id);
    setOpen(false);
  };

  /* --- render ---------------------------------------------------- */
  return (
    <div className="model-wrapper" ref={ref}>
      {/* ▸ bouton entête */}
      <button className="model-button" onClick={() => setOpen(p => !p)}>
        {current?.name || "Sélectionner"} <span className="arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="model-menu">
          <div className="menu-title">Modèle</div>

          {models.map(m => (
            <div
              key={m.id}
              className={`menu-row ${m.id === selected ? "active" : ""}`}
              onClick={() => choose(m.id)}
            >
              <div>
                <div className="row-name">{m.name}</div>
                <div className="row-sub">{m.subtitle}</div>
              </div>
              {m.id === selected && <span className="check">✔</span>}
            </div>
          ))}

          {/* <div className="menu-footer">Davantage de modèles ▸</div> */}
        </div>
      )}
    </div>
  );
};

export default AIModelSelector;
