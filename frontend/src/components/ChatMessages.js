import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessages.css";
import CodeBlock from "./CodeBlock";
import pdfIcon from "../assets/pdf_icone.png";
import wordIcon from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon from "../assets/txt_icone.png";
const getIcon = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf")
        return { src: pdfIcon, alt: "PDF" };
    if (ext === "doc" || ext === "docx")
        return { src: wordIcon, alt: "Word" };
    if (["xls", "xlsx", "csv"].includes(ext))
        return { src: excelIcon, alt: "Excel" };
    if (ext === "txt")
        return { src: txtIcon, alt: "TXT" };
    return { src: wordIcon, alt: "Fichier" };
};
/* ------- composant <code> passé à ReactMarkdown ----------------- */
const MarkdownCode = ({ inline, className, children, ...props }) => {
    if (inline) {
        return (React.createElement("code", { className: className, ...props }, children));
    }
    return React.createElement(CodeBlock, { className: className }, children);
};
const ChatMessages = ({ messages, streaming, waitingForDoc, nbDocs, }) => {
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, waitingForDoc, streaming]);
    /* “Réflexion…” tant que le dernier message n’est pas du bot */
    const last = messages[messages.length - 1];
    const noBotYet = streaming && (!last || last.sender !== "bot");
    return (React.createElement("div", { className: "chat-messages" },
        messages.map((m, idx) => {
            const isUser = m.sender === "user";
            const bubbleCls = `message-item ${isUser ? "message-user" : "message-bot"}`;
            const isLastBot = !isUser && idx === messages.length - 1;
            return (React.createElement("div", { key: m.id, className: bubbleCls },
                React.createElement("div", { className: "message-bubble" },
                    m.attachments?.length ? (React.createElement("div", { className: "message-attachments" }, m.attachments.map((att, i) => {
                        const { src, alt } = getIcon(att.name);
                        const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
                        return (React.createElement("div", { key: i, className: "attachment" },
                            React.createElement("img", { src: src, alt: alt, className: "attachment-icon" }),
                            React.createElement("div", { className: "attachment-info" },
                                React.createElement("div", { className: "attachment-name" }, att.name),
                                React.createElement("div", { className: "attachment-type" }, ext))));
                    }))) : null,
                    m.text &&
                        (isUser ? (React.createElement("pre", { className: "message-text" }, m.text)) : (React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { code: MarkdownCode } }, m.text))),
                    isLastBot && streaming && !m.text && (React.createElement("span", { className: "bot-spinner" })))));
        }),
        noBotYet && !waitingForDoc && (React.createElement("div", { className: "thinking-placeholder" }, "R\u00E9flexion\u2026")),
        waitingForDoc && (React.createElement("div", { className: "thinking-placeholder" }, nbDocs > 1 ? "Chargement des documents…" : "Chargement du document…")),
        React.createElement("div", { ref: endRef })));
};
export default ChatMessages;
