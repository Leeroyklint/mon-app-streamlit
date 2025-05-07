import React, { useState, useRef } from "react";
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
const ChatInput = ({ onSend, disabled = false, uploading = false, variant = "bottom" }) => {
    const [msg, setMsg] = useState("");
    const [files, setFiles] = useState([]);
    const fileRef = useRef(null);
    const add = (fs) => setFiles(prev => [...prev, ...Array.from(fs)]);
    const remove = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
    const send = () => {
        if (disabled || uploading)
            return;
        if (!msg.trim() && files.length === 0)
            return;
        onSend(msg.trim(), files);
        setMsg("");
        setFiles([]);
        if (fileRef.current)
            fileRef.current.value = "";
    };
    /* ---------- dnd ---------- */
    const dragOver = (e) => { if (!disabled && !uploading) {
        e.preventDefault();
    } };
    const drop = (e) => { if (!disabled && !uploading) {
        e.preventDefault();
        add(e.dataTransfer.files);
    } };
    /* ---------- dom ---------- */
    const root = variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";
    const blocked = disabled || uploading;
    return (React.createElement("form", { className: root, onSubmit: e => { e.preventDefault(); send(); }, onDragOver: dragOver, onDrop: drop },
        React.createElement("textarea", { rows: 1, value: msg, onChange: e => setMsg(e.target.value), onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
            } }, placeholder: "Posez une question ou joignez un fichier\u2026", className: "chat-input-input", disabled: blocked }),
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
            React.createElement("button", { type: "submit", className: "chat-input-button", disabled: blocked }, uploading ? React.createElement("span", { className: "btn-spinner" }) : "Envoyer"))));
};
export default ChatInput;
