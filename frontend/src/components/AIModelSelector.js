import React, { useEffect, useRef, useState } from "react";
import { selectModel } from "../services/modelService";
import "./AIModelSelector.css";
const AIModelSelector = ({ models }) => {
    const defaultId = models[0]?.id ?? "";
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(defaultId);
    const ref = useRef(null);
    /* --- click hors composant -> referme --------------------------- */
    useEffect(() => {
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        window.addEventListener("mousedown", onClick);
        return () => window.removeEventListener("mousedown", onClick);
    }, []);
    /* --- mise à jour backend -------------------------------------- */
    useEffect(() => {
        if (selected)
            selectModel(selected).catch(console.error);
    }, [selected]);
    /* --- helpers --------------------------------------------------- */
    const current = models.find(m => m.id === selected);
    const choose = (id) => {
        setSelected(id);
        setOpen(false);
    };
    /* --- render ---------------------------------------------------- */
    return (React.createElement("div", { className: "model-wrapper", ref: ref },
        React.createElement("button", { className: "model-button", onClick: () => setOpen(p => !p) },
            current?.name || "Sélectionner",
            " ",
            React.createElement("span", { className: "arrow" }, open ? "▲" : "▼")),
        open && (React.createElement("div", { className: "model-menu" },
            React.createElement("div", { className: "menu-title" }, "Mod\u00E8le"),
            models.map(m => (React.createElement("div", { key: m.id, className: `menu-row ${m.id === selected ? "active" : ""}`, onClick: () => choose(m.id) },
                React.createElement("div", null,
                    React.createElement("div", { className: "row-name" }, m.name),
                    React.createElement("div", { className: "row-sub" }, m.subtitle)),
                m.id === selected && React.createElement("span", { className: "check" }, "\u2714"))))))));
};
export default AIModelSelector;
