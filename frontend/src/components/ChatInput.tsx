import React, { useState, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import "./ChatInput.css";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

interface ChatInputProps {
  onSend: (message: string, files: File[]) => void;
  disabled?: boolean;
  /** "bottom" (défaut) = style fixe bas ; "center" = largeur 100 % pour Welcome */
  variant?: "bottom" | "center";
}

/* ---------- icône selon extension ---------- */
const getIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")               return pdfIcon;
  if (ext === "doc" || ext === "docx") return wordIcon;
  if (["xls","xlsx","csv"].includes(ext)) return excelIcon;
  if (ext === "txt")               return txtIcon;
  return wordIcon;
};

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  variant = "bottom",
}) => {
  const [message, setMessage]           = useState("");
  const [selectedFiles, setSelected]    = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- fichiers sélectionnés ---------- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelected(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };
  const removeFile = (idx: number) =>
    setSelected(prev => prev.filter((_, i) => i !== idx));

  /* ---------- envoi ---------- */
  const submit = () => {
    const trimmed = message.trim();
    if (trimmed || selectedFiles.length) {
      onSend(trimmed, selectedFiles);
      setMessage("");
      setSelected([]);
      fileInputRef.current && (fileInputRef.current.value = "");
    }
  };
  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); submit(); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  /* ---------- classes ---------- */
  const rootCls =
    variant === "bottom" ? "chat-input-form bottom" : "chat-input-form";

  return (
    <form className={rootCls} onSubmit={onSubmit}>
      <TextareaAutosize
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        minRows={1}
        maxRows={6}
        style={{ overflowY:"auto", resize:"none" }}
        disabled={disabled}
      />

      {/* mini-cartes fichiers */}
      <div className="input-attachment-container">
        {selectedFiles.map((f, i) => {
          const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
          return (
            <div key={i} className="input-attachment">
              <img src={getIcon(f.name)} alt={ext} className="file-icon" />
              <div className="input-attachment-info">
                <div className="input-file-name">{f.name}</div>
                <div className="input-file-type">{ext}</div>
              </div>
              <button
                type="button"
                className="input-remove-btn"
                onClick={() => removeFile(i)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="chat-input-button-row">
        <div className="chat-input-file">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display:"none" }}
            onChange={handleFileChange}
            disabled={disabled}
          />
          <button
            type="button"
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Joindre un document
          </button>
        </div>
        <button type="submit" className="chat-input-button" disabled={disabled}>
          Envoyer
        </button>
      </div>
    </form>
  );
};

export default ChatInput;
