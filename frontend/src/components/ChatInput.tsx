import React, { useState, useRef, useEffect, useCallback } from "react";
import "./ChatInput.css";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

interface Props {
  onSend: (message: string, files: File[]) => void;
  onStop: () => void;
  disabled?: boolean;          /* upload ou autre */
  streaming?: boolean;         /* génération en cours */
  variant?: "bottom" | "center";
}

/* ---------- icône fichier ---------- */
const icon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")                     return pdfIcon;
  if (ext === "doc" || ext === "docx")   return wordIcon;
  if (["xls","xlsx","csv"].includes(ext))return excelIcon;
  if (ext === "txt")                     return txtIcon;
  return wordIcon;
};

/* ---------- constantes auto-resize ---------- */
const MIN_HEIGHT = 28;   // ≃ 1 ligne
const MAX_HEIGHT = 180;  // hauteur maxi (≈ 6 lignes)

const ChatInput: React.FC<Props> = ({
  onSend,
  onStop,
  disabled = false,
  streaming = false,
  variant = "bottom",
}) => {
  const [msg,   setMsg]   = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef           = useRef<HTMLInputElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  /* ---------- helpers fichiers ---------- */
  const add    = (fs: FileList | File[]) =>
    setFiles(prev => [...prev, ...Array.from(fs)]);
  const remove = (i: number) =>
    setFiles(prev => prev.filter((_, idx) => idx !== i));

  /* ---------- auto-resize ---------- */
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";                       // remet à 1 ligne
    const newH = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height    = `${newH}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  /* resize quand msg change ou à l’ouverture */
  useEffect(resize, [msg, resize]);

  /* ---------- envoi ---------- */
  const send = () => {
    if (disabled || streaming) return;
    if (!msg.trim() && files.length === 0) return;
    onSend(msg.trim(), files);
    setMsg("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ---------- drag-n-drop ---------- */
  const dragOver = (e: React.DragEvent) => {
    if (!disabled && !streaming) e.preventDefault();
  };
  const drop = (e: React.DragEvent) => {
    if (!disabled && !streaming) {
      e.preventDefault();
      add(e.dataTransfer.files);
    }
  };

  /* ---------- DOM ---------- */
  const root     = variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";
  const blocked  = disabled || streaming;

  return (
    <form
      className={root}
      onSubmit={e => {
        e.preventDefault();
        send();
      }}
      onDragOver={dragOver}
      onDrop={drop}
    >
      {/* champ — textarea auto-redimensionnable */}
      <textarea
        ref={textareaRef}
        rows={1}
        style={{ height: MIN_HEIGHT }}
        value={msg}
        onChange={e => {
          setMsg(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            streaming ? onStop() : send();
          }
        }}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        disabled={disabled}
      />

      {/* fichiers sélectionnés ------------------------------------------------ */}
      <div className="input-attachment-container">
        {files.map((f, i) => (
          <div key={i} className="input-attachment">
            <img src={icon(f.name)} alt="" className="file-icon" />
            <div className="input-attachment-info">
              <div className="input-file-name">{f.name}</div>
              <div className="input-file-type">{f.name.split(".").pop()}</div>
            </div>
            <button
              type="button"
              className="input-remove-btn"
              onClick={() => remove(i)}
              disabled={blocked}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* barre de boutons ----------------------------------------------------- */}
      <div className="chat-input-button-row">
        <div className="chat-input-file">
          <input
            type="file"
            multiple
            ref={fileRef}
            style={{ display: "none" }}
            onChange={e => add(e.target.files!)}
            disabled={blocked}
          />
          <button
            type="button"
            className="file-upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={blocked}
          >
            Joindre un document
          </button>
        </div>

        <button type="submit" className="chat-input-button" disabled={disabled}>
          {streaming ? "Stop" : "Envoyer"}
        </button>
      </div>
    </form>
  );
};

export default ChatInput;
