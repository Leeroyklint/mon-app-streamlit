import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm     from "remark-gfm";
import "./ChatMessages.css";

import { Message, Attachment } from "../interfaces/interfaces";
import CodeBlock from "./CodeBlock";

/* ---------- icônes fichiers ---------- */
import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

const IMG_EXT = ["jpg","jpeg","png","gif","webp","bmp","svg"];
const isImg   = (e:string) => IMG_EXT.includes(e);

const icon = (ext:string) => {
  if (ext === "pdf")           return pdfIcon;
  if (ext === "doc" || ext === "docx") return wordIcon;
  if (["xls","xlsx","csv"].includes(ext)) return excelIcon;
  if (ext === "txt")           return txtIcon;
  return wordIcon;
};

/* --------- render <code> blocks -------- */
const MarkdownCode:React.FC<any> = ({ inline, className, children, ...p }) =>
  inline
    ? <code className={className} {...p}>{children}</code>
    : <CodeBlock className={className}>{children}</CodeBlock>;

/* --------- helper : réponse “code brut” (HTML/CSS) ---------- */
const isRawCode = (txt: string) =>
  /^<!doctype|^<html|^<head|^<body/i.test(txt.trim());

/* ------------------------------------------------------------ */
interface Props {
  messages:      Message[];
  streaming:     boolean;
  waitingForDoc: boolean;
  generating:    boolean;
  nbDocs:        number;
}

const ChatMessages:React.FC<Props> = ({
  messages,
  streaming,
  waitingForDoc,
  generating,
  nbDocs,
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); },
            [messages, waitingForDoc, streaming, generating]);

  const last      = messages[messages.length-1];
  const botTyping = streaming && (!last || last.sender !== "bot");

  return (
    <div className="chat-messages">
      {messages.map((m, idx) => {
        const isUser    = m.sender === "user";
        const bubbleCls = `message-item ${isUser ? "message-user" : "message-bot"}`;
        const isLastBot = !isUser && idx === messages.length-1;

        return (
          <div key={m.id} className={bubbleCls}>
            <div className="message-bubble">
              {/* -------- Pièces jointes -------- */}
              {m.attachments?.length && (
                <div className="message-attachments">
                  {m.attachments.map((att,i) => {
                    const ext = (att.name.split(".").pop() || "").toLowerCase();
                    const img = isImg(ext) && att.url;
                    const src = img ? att.url : icon(ext);
                    return (
                      <div key={i} className="attachment">
                        {img ? (
                          <a href={att.url} target="_blank" rel="noreferrer">
                            <img src={src} className="attachment-image" alt="" />
                          </a>
                        ) : (
                          <a href={att.url} target="_blank" rel="noreferrer" className="file-link">
                            <img src={src} className="attachment-icon" alt="" />
                          </a>
                        )}

                        {!img && (
                          <div className="attachment-info">
                            <div className="attachment-name">
                              {att.name.length>28 ? att.name.slice(0,25)+"…" : att.name}
                            </div>
                            <div className="attachment-type">{ext}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* -------- Texte -------- */}
              {m.text && (
                isUser
                  ? <pre className="message-text">{m.text}</pre>
                  : isRawCode(m.text)
                      ? <pre className="message-code">{m.text}</pre>
                      : <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{ code:MarkdownCode }}
                        >
                          {m.text}
                        </ReactMarkdown>
              )}

              {isLastBot && streaming && !m.text && <span className="bot-spinner" />}
            </div>
          </div>
        );
      })}

      {/* ------ placeholders globaux ------ */}
      {botTyping      && !waitingForDoc && <div className="thinking-placeholder">Réflexion…</div>}
      {waitingForDoc  && <div className="thinking-placeholder">
                           {nbDocs>1 ? "Chargement des documents…" : "Chargement du document…"}
                         </div>}
      {/* {generating     && <div className="thinking-placeholder">Génération de l’image…</div>} */}

      <div ref={endRef}/>
    </div>
  );
};

export default ChatMessages;
