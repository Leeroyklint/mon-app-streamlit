import React, { useState, useRef, useEffect, useCallback } from "react";
import "./ChatInput.css";
import pdfIcon from "../assets/pdf_icone.png";
import wordIcon from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon from "../assets/txt_icone.png";
/* ---------- icône fichier ---------- */
const icon = (name) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf")
        return pdfIcon;
    if (ext === "doc" || ext === "docx")
        return wordIcon;
    if (["xls", "xlsx", "csv"].includes(ext))
        return excelIcon;
    if (ext === "txt")
        return txtIcon;
    return wordIcon;
};
/* ---------- constantes auto-resize ---------- */
const MIN_HEIGHT = 28; // ≃ 1 ligne
const MAX_HEIGHT = 180; // ≃ 6 lignes
const ChatInput = ({ onSend, onStop, disabled = false, streaming = false, variant = "bottom", }) => {
    const [msg, setMsg] = useState("");
    const [files, setFiles] = useState([]);
    const fileRef = useRef(null);
    const textareaRef = useRef(null);
    /* ---------- helpers fichiers ---------- */
    const add = (fs) => setFiles(prev => [...prev, ...Array.from(fs)]);
    const remove = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
    /* ---------- auto-resize ---------- */
    const resize = useCallback(() => {
        const el = textareaRef.current;
        if (!el)
            return;
        el.style.height = "auto";
        const newH = Math.min(el.scrollHeight, MAX_HEIGHT);
        el.style.height = `${newH}px`;
        el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    }, []);
    useEffect(resize, [msg, resize]);
    /* ---------- envoi ---------- */
    const send = () => {
        if (disabled || streaming)
            return;
        if (!msg.trim() && files.length === 0)
            return;
        onSend(msg.trim(), files);
        setMsg("");
        setFiles([]);
        if (fileRef.current)
            fileRef.current.value = "";
    };
    /* ---------- clic principal (Stop ou Envoyer) ---------- */
    const primaryClick = () => {
        streaming ? onStop() : send();
    };
    /* ---------- drag-n-drop ---------- */
    const dragOver = (e) => {
        if (!disabled && !streaming)
            e.preventDefault();
    };
    const drop = (e) => {
        if (!disabled && !streaming) {
            e.preventDefault();
            add(e.dataTransfer.files);
        }
    };
    /* ---------- DOM ---------- */
    const root = variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";
    const blocked = disabled || streaming;
    return (React.createElement("form", { className: root, onSubmit: e => {
            e.preventDefault();
            primaryClick(); // Enter dans le formulaire
        }, onDragOver: dragOver, onDrop: drop },
        React.createElement("textarea", { ref: textareaRef, rows: 1, style: { height: MIN_HEIGHT }, value: msg, onChange: e => setMsg(e.target.value), onKeyDown: e => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    primaryClick(); // Enter dans le textarea
                }
            }, placeholder: "Posez une question ou joignez un fichier\u2026", className: "chat-input-input", disabled: disabled }),
        React.createElement("div", { className: "input-attachment-container" }, files.map((f, i) => (React.createElement("div", { key: i, className: "input-attachment" },
            React.createElement("img", { src: icon(f.name), alt: "", className: "file-icon" }),
            React.createElement("div", { className: "input-attachment-info" },
                React.createElement("div", { className: "input-file-name" }, f.name),
                React.createElement("div", { className: "input-file-type" }, f.name.split(".").pop())),
            React.createElement("button", { type: "button", className: "input-remove-btn", onClick: () => remove(i), disabled: blocked }, "\u2715"))))),
        React.createElement("div", { className: "chat-input-button-row" },
            React.createElement("div", { className: "chat-input-file" },
                React.createElement("input", { type: "file", multiple: true, ref: fileRef, style: { display: "none" }, onChange: e => add(e.target.files), disabled: blocked }),
                React.createElement("button", { type: "button", className: "file-upload-btn", onClick: () => fileRef.current?.click(), disabled: blocked }, "Joindre un document")),
            React.createElement("button", { type: "button" /* plus "submit" */, className: "chat-input-button", disabled: disabled, onClick: primaryClick }, streaming ? "Stop" : "Envoyer"))));
};
export default ChatInput;
