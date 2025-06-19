import React, { useState, useRef, useEffect, useCallback } from "react";
import "./ChatInput.css";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";
import plusIcon  from "../assets/plus.png";
import worldIcon from "../assets/world.png";

import { useWeb } from "../contexts/WebContext";

interface Props {
  onSend   : (msg: string, files: File[]) => void;
  onStop   : () => void;
  disabled?: boolean;
  streaming?: boolean;
  variant? : "bottom" | "center";
}

/* ───────── helpers fichiers ───────── */
const IMG_EXT = ["jpg","jpeg","png","gif","webp","bmp","svg"];
const isImg   = (e: string) => IMG_EXT.includes(e);
const icon    = (e: string) => {
  if (e === "pdf")                 return pdfIcon;
  if (e === "doc" || e === "docx") return wordIcon;
  if (["xls","xlsx","csv"].includes(e)) return excelIcon;
  if (e === "txt")                 return txtIcon;
  return wordIcon;
};

/* ───────── auto-resize textarea ───────── */
const MIN_H = 28, MAX_H = 180;

const ChatInput: React.FC<Props> = ({
  onSend,
  onStop,
  disabled   = false,
  streaming  = false,
  variant    = "bottom",
}) => {
  const [msg, setMsg]   = useState("");
  interface FileWithPreview extends File { preview?: string }
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const txtRef  = useRef<HTMLTextAreaElement>(null);

  /* Web-search context */
  const { web, toggle } = useWeb();

  /* ───────── helpers fichiers ───────── */
  const add = (fs: FileList | File[]) =>
    setFiles(prev => [
      ...prev,
      ...Array.from(fs).map(f => Object.assign(f, { preview: URL.createObjectURL(f) })),
    ]);

  const rm = (i: number) =>
    setFiles(prev => {
      const removed = prev[i] as any;
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, idx) => idx !== i);
    });

  /* libère les blobs à l’unmount */
  useEffect(() => () => {
    files.forEach(f => (f as any).preview && URL.revokeObjectURL((f as any).preview));
  }, [files]);

  /* resize textarea */
  const resize = useCallback(() => {
    const el = txtRef.current; if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, MAX_H);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > MAX_H ? "auto" : "hidden";
  }, []);
  useEffect(resize, [msg, resize]);

  /* ───────── envoi / stop ───────── */
  const doSend = () => {
    if (disabled || streaming)           return;
    if (!msg.trim() && files.length === 0) return;

    onSend(msg.trim(), files);
    setMsg(""); setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };
  const primary = () => (streaming ? onStop() : doSend());

  const blocked = disabled || streaming;
  const rootCls = variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";

  return (
    <form
      className={rootCls}
      onSubmit={e => { e.preventDefault(); primary(); }}
      onDragOver={e => { if (!blocked) e.preventDefault(); }}
      onDrop={e => { if (blocked) return; e.preventDefault(); add(e.dataTransfer.files); }}
    >

      {/* ───────── zone de saisie ───────── */}
      <textarea
        ref={txtRef}
        rows={1}
        style={{ height: MIN_H }}
        value={msg}
        onChange={e => setMsg(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); primary(); }
        }}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        disabled={disabled}
      />

      {/* ───────── pré-visualisation pièces jointes ───────── */}
      <div className="input-attachment-container">
        {files.map((f, i) => {
          const ext = (f.name.split(".").pop() || "").toLowerCase();
          const preview = (f as any).preview;
          const src = isImg(ext) && preview ? preview : icon(ext);

          return (
            <div key={i} className="input-attachment">
              <img src={src} alt="" className={isImg(ext) ? "file-preview" : "file-icon"} />
              <div className="input-attachment-info">
                <div className="input-file-name">
                  {f.name.length > 28 ? f.name.slice(0, 25) + "…" : f.name}
                </div>
                <div className="input-file-type">{ext}</div>
              </div>
              <button
                type="button"
                className="input-remove-btn"
                onClick={() => rm(i)}
                disabled={blocked}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* ───────── footer : + / 🌍 / Envoyer ───────── */}
      <div className="chat-input-button-row">

        {/* + (add files) */}
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
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          disabled={blocked}
          title="Joindre un fichier"
        >
          <img src={plusIcon} alt="+" />
        </button>

        {/* 🌍 (toggle web-search) */}
        <button
          type="button"
          className={`icon-btn ${web ? "active" : ""}`}
          onClick={toggle}
          title="Activer/Désactiver la recherche Web"
          disabled={disabled}
        >
          <img src={worldIcon} alt="Web" />
        </button>

        {/* Envoyer / Stop — aligné à droite via margin-left:auto dans le CSS */}
        <button
          type="button"
          className="chat-input-button"
          onClick={primary}
          disabled={disabled}
        >
          {streaming ? "Stop" : "Envoyer"}
        </button>
      </div>
    </form>
  );
};

export default ChatInput;
