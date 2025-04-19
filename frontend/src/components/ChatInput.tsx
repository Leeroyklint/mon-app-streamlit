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
}

/* ---------- icône selon extension ---------- */
const getIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return pdfIcon;
  if (ext === "doc" || ext === "docx") return wordIcon;
  if (["xls", "xlsx", "csv"].includes(ext)) return excelIcon;
  if (ext === "txt") return txtIcon;
  return wordIcon;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled = false }) => {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- fichiers sélectionnés ---------- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files as FileList);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };
  const handleRemoveFile = (i: number) =>
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i));

  /* ---------- envoi ---------- */
  const submit = () => {
    const trimmed = message.trim();
    if (trimmed || selectedFiles.length) {
      onSend(trimmed, selectedFiles);
      setMessage("");
      setSelectedFiles([]);
      fileInputRef.current && (fileInputRef.current.value = "");
    }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <TextareaAutosize
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        minRows={1}
        maxRows={6}
        style={{ overflowY: "auto", resize: "none" }}
        disabled={disabled}
      />

      {/* mini‑cartes fichiers */}
      <div className="input-attachment-container">
        {selectedFiles.map((file, i) => {
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          return (
            <div key={i} className="input-attachment">
              <img src={getIcon(file.name)} alt={ext} className="file-icon" />
              <div className="input-attachment-info">
                <div className="input-file-name">{file.name}</div>
                <div className="input-file-type">{ext}</div>
              </div>
              <button
                type="button"
                className="input-remove-btn"
                onClick={() => handleRemoveFile(i)}
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
            style={{ display: "none" }}
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
