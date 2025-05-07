import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessages.css";
import { Message, Attachment } from "../interfaces/interfaces";
import CodeBlock from "./CodeBlock";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

/* ------------------------------------------------------------------ */
/* Typage très souple : rien n’est obligatoire ----------------------- */
interface MarkdownCodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;          // ⬅️ optionnel
}
/* ------------------------------------------------------------------ */

const getIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")               return { src: pdfIcon,   alt: "PDF"   };
  if (ext === "doc" || ext === "docx")
                                   return { src: wordIcon,  alt: "Word"  };
  if (["xls", "xlsx", "csv"].includes(ext))
                                   return { src: excelIcon, alt: "Excel" };
  if (ext === "txt")               return { src: txtIcon,   alt: "TXT"   };
  return { src: wordIcon, alt: "Fichier" };
};

/* ------------------------------------------------------------------ */
/* Composant <code> transmis à ReactMarkdown                          */
const MarkdownCode: React.FC<MarkdownCodeProps> = ({
  inline,
  className,
  children,
  ...props
}) => {
  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
  return (
    <CodeBlock className={className}>
      {children}
    </CodeBlock>
  );
};
/* ------------------------------------------------------------------ */

interface Props { messages: Message[]; }

const ChatMessages: React.FC<Props> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="chat-messages">
      {messages.map((m) => {
        const isUser    = m.sender === "user";
        const bubbleCls = `message-item ${isUser ? "message-user" : "message-bot"}`;

        return (
          <div key={m.id} className={bubbleCls}>
            <div className="message-bubble">

              {/* === pièces-jointes ===================================== */}
              {m.attachments?.length ? (
                <div className="message-attachments">
                  {m.attachments.map((att: Attachment, i) => {
                    const { src, alt } = getIcon(att.name);
                    const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
                    return (
                      <div key={i} className="attachment">
                        <img src={src} alt={alt} className="attachment-icon" />
                        <div className="attachment-info">
                          <div className="attachment-name">{att.name}</div>
                          <div className="attachment-type">{ext}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* === texte / Markdown =================================== */}
              {m.text &&
                (isUser ? (
                  <pre className="message-text">{m.text}</pre>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    /*  ⬇️ on caste pour coller au type attendu --------- */
                    components={{ code: MarkdownCode as React.ComponentType<any> }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ))}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default ChatMessages;
