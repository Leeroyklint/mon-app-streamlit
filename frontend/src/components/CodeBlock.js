import React, { useState } from "react";
import "./ChatMessages.css";
const CodeBlock = ({ className = "", children, }) => {
    const code = String(children ?? "");
    if (!code.includes("\n")) {
        return React.createElement("code", { className: className }, children);
    }
    const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "txt";
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
        catch { /* ignore */ }
    };
    return (React.createElement("div", { className: "code-block" },
        React.createElement("div", { className: "code-block-header" },
            React.createElement("span", { className: "code-lang" }, language),
            React.createElement("button", { className: "copy-btn", onClick: copy }, copied ? "Copié !" : "Copier")),
        React.createElement("pre", null,
            React.createElement("code", { className: className }, code))));
};
export default CodeBlock;
