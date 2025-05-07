import React, { useState, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import "./ChatInput.css";
import pdfIcon from "../assets/pdf_icone.png";
import wordIcon from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon from "../assets/txt_icone.png";
/* ---------- icône selon extension ---------- */
const getIcon = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
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
const ChatInput = ({ onSend, disabled = false, variant = "bottom", }) => {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelected] = useState([]);
    const fileInputRef = useRef(null);
    /* ---------- fichiers sélectionnés ---------- */
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelected(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };
    const removeFile = (idx) => setSelected(prev => prev.filter((_, i) => i !== idx));
    /* ---------- envoi ---------- */
    const submit = () => {
        const trimmed = message.trim();
        if (trimmed || selectedFiles.length) {
            onSend(trimmed, selectedFiles);
            setMessage("");
            setSelected([]);
            fileInputRef.current && (fileInputRef.current.value = "");
        }
    };
    const onSubmit = (e) => { e.preventDefault(); submit(); };
    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };
    /* ---------- classes ---------- */
    const rootCls = variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";
    return (React.createElement("form", { className: rootCls, onSubmit: onSubmit },
        React.createElement(TextareaAutosize, { value: message, onChange: (e) => setMessage(e.target.value), onKeyDown: onKeyDown, placeholder: "Posez une question ou joignez un fichier\u2026", className: "chat-input-input", minRows: 1, maxRows: 6, style: { overflowY: "auto", resize: "none" }, disabled: disabled }),
        React.createElement("div", { className: "input-attachment-container" }, selectedFiles.map((f, i) => {
            const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
            return (React.createElement("div", { key: i, className: "input-attachment" },
                React.createElement("img", { src: getIcon(f.name), alt: ext, className: "file-icon" }),
                React.createElement("div", { className: "input-attachment-info" },
                    React.createElement("div", { className: "input-file-name" }, f.name),
                    React.createElement("div", { className: "input-file-type" }, ext)),
                React.createElement("button", { type: "button", className: "input-remove-btn", onClick: () => removeFile(i) }, "\u2715")));
        })),
        React.createElement("div", { className: "chat-input-button-row" },
            React.createElement("div", { className: "chat-input-file" },
                React.createElement("input", { ref: fileInputRef, type: "file", multiple: true, style: { display: "none" }, onChange: handleFileChange, disabled: disabled }),
                React.createElement("button", { type: "button", className: "file-upload-btn", onClick: () => fileInputRef.current?.click(), disabled: disabled }, "Joindre un document")),
            React.createElement("button", { type: "submit", className: "chat-input-button", disabled: disabled }, "Envoyer"))));
};
export default ChatInput;
