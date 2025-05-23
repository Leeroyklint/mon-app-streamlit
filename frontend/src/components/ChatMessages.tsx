import React,{useEffect,useRef} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessages.css";
import { Message, Attachment } from "../interfaces/interfaces";
import CodeBlock from "./CodeBlock";

import pdfIcon   from "../assets/pdf_icone.png";
import wordIcon  from "../assets/word_icone.png";
import excelIcon from "../assets/csv_icone.png";
import txtIcon   from "../assets/txt_icone.png";

const IMG_EXT=["jpg","jpeg","png","gif","webp","bmp","svg"];
const isImg=(e:string)=>IMG_EXT.includes(e);
const icon=(e:string)=>{
  if(e==="pdf")return pdfIcon;
  if(e==="doc"||e==="docx")return wordIcon;
  if(["xls","xlsx","csv"].includes(e))return excelIcon;
  if(e==="txt")return txtIcon;
  return wordIcon;
};

const MarkdownCode:React.FC<any>=({inline,className,children,...p})=>
  inline
    ? <code className={className} {...p}>{children}</code>
    : <CodeBlock className={className}>{children}</CodeBlock>;

interface Props{
  messages:Message[]; streaming:boolean;
  waitingForDoc:boolean; nbDocs:number;
}

const ChatMessages:React.FC<Props>=({
  messages,streaming,waitingForDoc,nbDocs
})=>{
  const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},
             [messages,waitingForDoc,streaming]);

  const last=messages[messages.length-1];
  const noBot=streaming&&(!last||last.sender!=="bot");

  return(
    <div className="chat-messages">
      {messages.map((m,idx)=>{
        const isUser=m.sender==="user";
        const bubble=`message-item ${isUser?"message-user":"message-bot"}`;
        const isLastBot=!isUser&&idx===messages.length-1;
        return(
          <div key={m.id} className={bubble}>
            <div className="message-bubble">

              {/* ------- pièces jointes ------- */}
              {m.attachments?.length
                ? <div className="message-attachments">
                    {m.attachments.map((att,i)=>{
                      const ext=(att.name.split(".").pop()||"").toLowerCase();
                      const show=isImg(ext)&&att.url;
                      const src =show?att.url:icon(ext);
                      return(
                        <div key={i} className="attachment">
                          <img
                            src={src}
                            alt={att.name}
                            className={show?"attachment-image":"attachment-icon"}
                            onError={e=>{(e.target as HTMLImageElement).src=icon(ext);}}
                          />
                          <div className="attachment-info">
                            <div className="attachment-name">
                              {att.name.length>28?att.name.slice(0,25)+"…":att.name}
                            </div>
                            <div className="attachment-type">{ext}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                : null}

              {/* ------- texte / markdown ------- */}
              {m.text && (isUser
                ? <pre className="message-text">{m.text}</pre>
                : <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{code:MarkdownCode}}
                  >{m.text}</ReactMarkdown>)}

              {isLastBot&&streaming&&!m.text&&<span className="bot-spinner"/>}
            </div>
          </div>
        );
      })}

      {noBot&&!waitingForDoc&&<div className="thinking-placeholder">Réflexion…</div>}
      {waitingForDoc&&(
        <div className="thinking-placeholder">
          {nbDocs>1?"Chargement des documents…":"Chargement du document…"}
        </div>
      )}

      <div ref={endRef}/>
    </div>
  );
};
export default ChatMessages;
