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
const ChatMessages = ({ messages }) => {
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    return (React.createElement("div", { className: "chat-messages" },
        messages.map((m) => {
            const isUser = m.sender === "user";
            const bubbleCls = `message-item ${isUser ? "message-user" : "message-bot"}`;
            return (React.createElement("div", { key: m.id, className: bubbleCls },
                React.createElement("div", { className: "message-bubble" },
                    m.attachments?.length && (React.createElement("div", { className: "message-attachments" }, m.attachments.map((att, i) => {
                        const { src, alt } = getIcon(att.name);
                        const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
                        return (React.createElement("div", { key: i, className: "attachment" },
                            React.createElement("img", { src: src, alt: alt, className: "attachment-icon" }),
                            React.createElement("div", { className: "attachment-info" },
                                React.createElement("div", { className: "attachment-name" }, att.name),
                                React.createElement("div", { className: "attachment-type" }, ext))));
                    }))),
                    m.text &&
                        (isUser ? (
                        /* conserve les sauts de ligne */
                        React.createElement("pre", { className: "message-text" }, m.text)) : (React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { code: (p) => React.createElement(CodeBlock, { ...p }) } }, m.text))))));
        }),
        React.createElement("div", { ref: endRef })));
};
export default ChatMessages;
