import React, { useState, useRef, useEffect, useCallback } from "react";
import "./ChatInput.css";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

interface Props{
  onSend:(msg:string,files:File[])=>void;
  onStop:()=>void;
  disabled?:boolean;
  streaming?:boolean;
  variant?:"bottom"|"center";
}

/* ---------- helpers ---------- */
const IMG_EXT=["jpg","jpeg","png","gif","webp","bmp","svg"];
const isImg=(e:string)=>IMG_EXT.includes(e);
const icon=(e:string)=>{
  if(e==="pdf")return pdfIcon;
  if(e==="doc"||e==="docx")return wordIcon;
  if(["xls","xlsx","csv"].includes(e))return excelIcon;
  if(e==="txt")return txtIcon;
  return wordIcon;
};

/* ---------- auto-resize ---------- */
const MIN_H=28, MAX_H=180;

const ChatInput:React.FC<Props>=({
  onSend,onStop,disabled=false,streaming=false,variant="bottom"
})=>{
  const [msg,setMsg]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const fileRef=useRef<HTMLInputElement>(null);
  const txtRef =useRef<HTMLTextAreaElement>(null);

  const add=(fs:FileList|File[])=>setFiles(p=>[...p,...Array.from(fs)]);
  const rm =(i:number)=>setFiles(p=>p.filter((_,idx)=>idx!==i));

  const resize=useCallback(()=>{
    const el=txtRef.current; if(!el) return;
    el.style.height="auto";
    const h=Math.min(el.scrollHeight,MAX_H);
    el.style.height=`${h}px`;
    el.style.overflowY=el.scrollHeight>MAX_H?"auto":"hidden";
  },[]);
  useEffect(resize,[msg,resize]);

  const doSend=()=>{
    if(disabled||streaming) return;
    if(!msg.trim()&&files.length===0) return;
    onSend(msg.trim(),files);
    setMsg(""); setFiles([]);
    if(fileRef.current) fileRef.current.value="";
  };
  const primary=()=> streaming?onStop():doSend();

  const blocked=disabled||streaming;
  const root   =variant==="bottom"?"chat-input-form bottom":"chat-input-form";

  return(
    <form
      className={root}
      onSubmit={e=>{e.preventDefault();primary();}}
      onDragOver={e=>{if(!blocked) e.preventDefault();}}
      onDrop={e=>{
        if(blocked) return;
        e.preventDefault(); add(e.dataTransfer.files);
      }}
    >
      {/* --- textarea --- */}
      <textarea
        ref={txtRef}
        rows={1}
        style={{height:MIN_H}}
        value={msg}
        onChange={e=>setMsg(e.target.value)}
        onKeyDown={e=>{
          if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();primary();}
        }}
        placeholder="Posez une question ou joignez un fichier…"
        className="chat-input-input"
        disabled={disabled}
      />

      {/* --- pièces jointes preview --- */}
      <div className="input-attachment-container">
        {files.map((f,i)=>{
          const ext=(f.name.split(".").pop()||"").toLowerCase();
          const src=isImg(ext)?URL.createObjectURL(f):icon(ext);
          return(
            <div key={i} className="input-attachment">
              <img
                src={src}
                alt=""
                className={isImg(ext)?"file-preview":"file-icon"}
              />
              <div className="input-attachment-info">
                <div className="input-file-name">
                  {f.name.length>28?f.name.slice(0,25)+"…":f.name}
                </div>
                <div className="input-file-type">{ext}</div>
              </div>
              <button
                type="button"
                className="input-remove-btn"
                onClick={()=>rm(i)}
                disabled={blocked}
              >✕</button>
            </div>
          );
        })}
      </div>

      {/* --- footer --- */}
      <div className="chat-input-button-row">
        <div className="chat-input-file">
          <input
            type="file"
            multiple
            ref={fileRef}
            style={{display:"none"}}
            onChange={e=>add(e.target.files!)}
            disabled={blocked}
          />
          <button
            type="button"
            className="file-upload-btn"
            onClick={()=>fileRef.current?.click()}
            disabled={blocked}
          >Joindre un document</button>
        </div>

        <button
          type="button"
          className="chat-input-button"
          disabled={disabled}
          onClick={primary}
        >{streaming?"Stop":"Envoyer"}</button>
      </div>
    </form>
  );
};
export default ChatInput;
