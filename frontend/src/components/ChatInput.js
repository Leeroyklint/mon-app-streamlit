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
const ChatInput = ({ onSend, disabled = false }) => {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const fileInputRef = useRef(null);
    /* ---------- fichiers sélectionnés ---------- */
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setSelectedFiles((prev) => [...prev, ...filesArray]);
        }
    };
    const handleRemoveFile = (i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i));
    /* ---------- envoi ---------- */
    const submit = () => {
        const trimmed = message.trim();
        if (trimmed || selectedFiles.length) {
            onSend(trimmed, selectedFiles);
            setMessage("");
            setSelectedFiles([]);
            fileInputRef.current && (fileInputRef.current.value = "");
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        submit();
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };
    return (React.createElement("form", { className: "chat-input-form", onSubmit: handleSubmit },
        React.createElement(TextareaAutosize, { value: message, onChange: (e) => setMessage(e.target.value), onKeyDown: handleKeyDown, placeholder: "Posez une question ou joignez un fichier\u2026", className: "chat-input-input", minRows: 1, maxRows: 6, style: { overflowY: "auto", resize: "none" }, disabled: disabled }),
        React.createElement("div", { className: "input-attachment-container" }, selectedFiles.map((file, i) => {
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
            return (React.createElement("div", { key: i, className: "input-attachment" },
                React.createElement("img", { src: getIcon(file.name), alt: ext, className: "file-icon" }),
                React.createElement("div", { className: "input-attachment-info" },
                    React.createElement("div", { className: "input-file-name" }, file.name),
                    React.createElement("div", { className: "input-file-type" }, ext)),
                React.createElement("button", { type: "button", className: "input-remove-btn", onClick: () => handleRemoveFile(i) }, "\u2715")));
        })),
        React.createElement("div", { className: "chat-input-button-row" },
            React.createElement("div", { className: "chat-input-file" },
                React.createElement("input", { ref: fileInputRef, type: "file", multiple: true, style: { display: "none" }, onChange: handleFileChange, disabled: disabled }),
                React.createElement("button", { type: "button", className: "file-upload-btn", onClick: () => fileInputRef.current?.click(), disabled: disabled }, "Joindre un document")),
            React.createElement("button", { type: "submit", className: "chat-input-button", disabled: disabled }, "Envoyer"))));
};
export default ChatInput;
