import React, { useState } from "react";
import "./ChatMessages.css";

/* signature attendue par React‑Markdown ------------------------- */
export interface CodeProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bloc de code (compat. React‑Markdown)
 */
const CodeBlock: React.FC<CodeProps> = ({
  inline = false,
  className = "",
  children,
}) => {
  /* ----- code inline (<code>) --------------------------------- */
  if (inline) return <code className={className}>{children}</code>;

  /* ----- bloc -------------------------------------------------- */
  const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "txt";
  const code = String(children).replace(/\n$/, "");
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
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
