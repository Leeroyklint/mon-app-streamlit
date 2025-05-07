import React, { useState, useRef } from "react";
import "./ChatInput.css";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

interface Props {
  onSend: (message: string, files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
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

const ChatInput: React.FC<Props> = ({
  onSend, disabled=false, uploading=false, variant="bottom"
}) => {
  const [msg, setMsg]                = useState("");
  const [files, setFiles]            = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (fs: FileList|File[]) =>
    setFiles(prev => [...prev, ...Array.from(fs)]);
  const remove = (i:number) =>
    setFiles(prev => prev.filter((_,idx)=>idx!==i));

  const send = () => {
    if(disabled||uploading) return;
    if(!msg.trim() && files.length===0) return;
    onSend(msg.trim(), files);
    setMsg(""); setFiles([]); if(fileRef.current) fileRef.current.value="";
  };

  /* ---------- dnd ---------- */
  const dragOver = (e:React.DragEvent) => { if(!disabled&&!uploading){e.preventDefault();} };
  const drop     = (e:React.DragEvent) => { if(!disabled&&!uploading){e.preventDefault();add(e.dataTransfer.files);} };

  /* ---------- dom ---------- */
  const root = variant==="bottom" ? "chat-input-form bottom" : "chat-input-form";
  const blocked = disabled||uploading;

  return (
    <form className={root} onSubmit={e=>{e.preventDefault();send();}}
          onDragOver={dragOver} onDrop={drop}>
      {/* champ — textarea classique, rows=1, resize désactivé par CSS */}
      <textarea
        rows={1}
        value={msg}
        onChange={e=>setMsg(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){e.preventDefault();send();} }}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        disabled={blocked}
      />

      {/* fichiers */}
      <div className="input-attachment-container">
        {files.map((f,i)=>(
          <div key={i} className="input-attachment">
            <img src={icon(f.name)} alt="" className="file-icon"/>
            <div className="input-attachment-info">
              <div className="input-file-name">{f.name}</div>
              <div className="input-file-type">{f.name.split(".").pop()}</div>
            </div>
            <button type="button" className="input-remove-btn"
                    onClick={()=>remove(i)} disabled={blocked}>✕</button>
          </div>
        ))}
      </div>

      <div className="chat-input-button-row">
        <div className="chat-input-file">
          <input type="file" multiple ref={fileRef}
                 style={{display:"none"}}
                 onChange={e=>add(e.target.files!)} disabled={blocked}/>
          <button type="button" className="file-upload-btn"
                  onClick={()=>fileRef.current?.click()} disabled={blocked}>
            Joindre un document
          </button>
        </div>

        <button type="submit" className="chat-input-button" disabled={blocked}>
          {uploading ? <span className="btn-spinner"/> : "Envoyer"}
        </button>
      </div>
    </form>
  );
};

export default ChatInput;
