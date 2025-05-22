import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessages.css";
import CodeBlock from "./CodeBlock";
import pdfIcon from "../assets/pdf_icone.png";
import wordIcon from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon from "../assets/txt_icone.png";
const IMG_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
const isImg = (e) => IMG_EXT.includes(e);
const icon = (e) => {
    if (e === "pdf")
        return pdfIcon;
    if (e === "doc" || e === "docx")
        return wordIcon;
    if (["xls", "xlsx", "csv"].includes(e))
        return excelIcon;
    if (e === "txt")
        return txtIcon;
    return wordIcon;
};
const MarkdownCode = ({ inline, className, children, ...p }) => inline
    ? React.createElement("code", { className: className, ...p }, children)
    : React.createElement(CodeBlock, { className: className }, children);
const ChatMessages = ({ messages, streaming, waitingForDoc, nbDocs }) => {
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, waitingForDoc, streaming]);
    const last = messages[messages.length - 1];
    const noBot = streaming && (!last || last.sender !== "bot");
    return (React.createElement("div", { className: "chat-messages" },
        messages.map((m, idx) => {
            const isUser = m.sender === "user";
            const bubble = `message-item ${isUser ? "message-user" : "message-bot"}`;
            const isLastBot = !isUser && idx === messages.length - 1;
            return (React.createElement("div", { key: m.id, className: bubble },
                React.createElement("div", { className: "message-bubble" },
                    m.attachments?.length
                        ? React.createElement("div", { className: "message-attachments" }, m.attachments.map((att, i) => {
                            const ext = (att.name.split(".").pop() || "").toLowerCase();
                            const show = isImg(ext) && att.url;
                            const src = show ? att.url : icon(ext);
                            return (React.createElement("div", { key: i, className: "attachment" },
                                React.createElement("img", { src: src, alt: att.name, className: show ? "attachment-image" : "attachment-icon", onError: e => { e.target.src = icon(ext); } }),
                                React.createElement("div", { className: "attachment-info" },
                                    React.createElement("div", { className: "attachment-name" }, att.name.length > 28 ? att.name.slice(0, 25) + "…" : att.name),
                                    React.createElement("div", { className: "attachment-type" }, ext))));
                        }))
                        : null,
                    m.text && (isUser
                        ? React.createElement("pre", { className: "message-text" }, m.text)
                        : React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { code: MarkdownCode } }, m.text)),
                    isLastBot && streaming && !m.text && React.createElement("span", { className: "bot-spinner" }))));
        }),
        noBot && !waitingForDoc && React.createElement("div", { className: "thinking-placeholder" }, "R\u00E9flexion\u2026"),
        waitingForDoc && (React.createElement("div", { className: "thinking-placeholder" }, nbDocs > 1 ? "Chargement des documents…" : "Chargement du document…")),
        React.createElement("div", { ref: endRef })));
};
export default ChatMessages;
