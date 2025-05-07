import React, { useState } from "react";
import "./ChatMessages.css";

export interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;         // ⬅️ children devient optionnel
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  className = "",
  children,
}) => {
  const code = String(children ?? "");
  if (!code.includes("\n")) {
    return <code className={className}>{children}</code>;
  }

  const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "txt";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{language}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
