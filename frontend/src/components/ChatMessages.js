import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessages.css";
import CodeBlock from "./CodeBlock";
/* ---------- icônes fichiers ---------- */
import pdfIcon from "../assets/pdf_icone.png";
import wordIcon from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon from "../assets/txt_icone.png";
const IMG_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
const isImg = (e) => IMG_EXT.includes(e);
const icon = (ext) => {
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
/* --------- render <code> blocks -------- */
const MarkdownCode = ({ inline, className, children, ...p }) => inline
    ? React.createElement("code", { className: className, ...p }, children)
    : React.createElement(CodeBlock, { className: className }, children);
/* --------- helper : réponse “code brut” (HTML/CSS) ---------- */
const isRawCode = (txt) => /^<!doctype|^<html|^<head|^<body/i.test(txt.trim());
const ChatMessages = ({ messages, streaming, waitingForDoc, generating, nbDocs, }) => {
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, waitingForDoc, streaming, generating]);
    const last = messages[messages.length - 1];
    const botTyping = streaming && (!last || last.sender !== "bot");
    return (React.createElement("div", { className: "chat-messages" },
        messages.map((m, idx) => {
            const isUser = m.sender === "user";
            const bubbleCls = `message-item ${isUser ? "message-user" : "message-bot"}`;
            const isLastBot = !isUser && idx === messages.length - 1;
            return (React.createElement("div", { key: m.id, className: bubbleCls },
                React.createElement("div", { className: "message-bubble" },
                    m.attachments?.length && (React.createElement("div", { className: "message-attachments" }, m.attachments.map((att, i) => {
                        const ext = (att.name.split(".").pop() || "").toLowerCase();
                        const img = isImg(ext) && att.url;
                        const src = img ? att.url : icon(ext);
                        return (React.createElement("div", { key: i, className: "attachment" },
                            img ? (React.createElement("a", { href: att.url, target: "_blank", rel: "noreferrer" },
                                React.createElement("img", { src: src, className: "attachment-image", alt: "" }))) : (React.createElement("a", { href: att.url, target: "_blank", rel: "noreferrer", className: "file-link" },
                                React.createElement("img", { src: src, className: "attachment-icon", alt: "" }))),
                            !img && (React.createElement("div", { className: "attachment-info" },
                                React.createElement("div", { className: "attachment-name" }, att.name.length > 28 ? att.name.slice(0, 25) + "…" : att.name),
                                React.createElement("div", { className: "attachment-type" }, ext)))));
                    }))),
                    m.text && (isUser
                        ? React.createElement("pre", { className: "message-text" }, m.text)
                        : isRawCode(m.text)
                            ? React.createElement(CodeBlock, { className: "language-html" }, m.text)
                            : React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { code: MarkdownCode } }, m.text)),
                    isLastBot && streaming && !m.text && React.createElement("span", { className: "bot-spinner" }))));
        }),
        botTyping && !waitingForDoc && React.createElement("div", { className: "thinking-placeholder" }, "R\u00E9flexion\u2026"),
        waitingForDoc && React.createElement("div", { className: "thinking-placeholder" }, nbDocs > 1 ? "Chargement des documents…" : "Chargement du document…"),
        React.createElement("div", { ref: endRef })));
};
export default ChatMessages;
