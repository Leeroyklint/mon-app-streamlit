import React, { useEffect, useState, useRef } from "react";
import ChatInput      from "./ChatInput";
import ChatMessages   from "./ChatMessages";
import {
  askQuestionStream,
  createConversation,
  getMessages,
} from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import { reserve } from "../services/rateLimiter";
import { Message, Attachment } from "../interfaces/interfaces";
import { useModel } from "../contexts/ModelContext";
import { useWeb }   from "../contexts/WebContext"; 
import { createDocument }      from "../services/documentService";
import { detectDocRequest }    from "../utils/detectDocRequest";

const DocumentsChat: React.FC = () => {
  const [conversationId, setConvId] = useState<string>();
  const [messages, setMessages]     = useState<Message[]>([]);
  const [streaming, setStreaming]   = useState(false);
  const [generating, setGenerating] = useState(false);  
  const [ingesting, setIngesting]   = useState(false);
  const [nbDocs,    setNbDocs]      = useState(0);

  const idRef     = useRef(0);
  const streamRef = useRef<{ cancel: () => void } | null>(null);

  const { modelId } = useModel();
  const { web }     = useWeb(); 

  useEffect(() => {
    if (!conversationId) return;
    getMessages(conversationId).then(f =>
      setMessages(
        f.map((m: any, i: number) => ({
          id: i,
          text: m.content,
          sender: m.role === "assistant" ? "bot" : "user",
        }))
      )
    );
  }, [conversationId]);

  const add = (t: string, s: "user" | "bot", atts?: Attachment[]) =>
    setMessages(p => [...p, { id: idRef.current++, text: t, sender: s, ...(atts ? {attachments: atts} : {}) }]);

  const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };

  const handleSend = async (userMessage: string, files: File[]) => {
    if (streaming || ingesting) return;

    // ── active / désactive la recherche Web pour cette requête
    (window as any).___enableWeb = web;                // ← ligne à AJOUTER

    const convType = "doc";
    const cleanMsg = userMessage.trim();

    /* ---------- création de document ---------- */
    const kind = detectDocRequest(cleanMsg);
    if (kind) {
      try {
        const resp = await createDocument(kind, cleanMsg);
        const url  = URL.createObjectURL(await resp.blob());
        add(`Voici votre fichier ${kind}`, "bot",
            [{ name:`fichier.${kind}`, url, type:"application/octet-stream" }]);
      } catch(e){ console.error(e); add("❌ Erreur création fichier", "bot"); }
      return;                              // pas de LLM

    }

    /* ----- fichiers -> preview immédiate ----- */
    let preview: Attachment[] | undefined;
    if (files.length) {
      preview = files.map(f => ({
        name: f.name,
        url:  URL.createObjectURL(f),
        type: f.type || "Document",
      }));
      add(cleanMsg, "user", preview);

      setIngesting(true);
      setNbDocs(files.length);
      try {
        const res = await uploadDocuments(files, conversationId);
        setConvId(res.conversationId);
      } finally {
        setIngesting(false);
        setNbDocs(0);
      }
      if (!cleanMsg) return;               // pas de question -> on s’arrête là
    } else if (cleanMsg) {
      add(cleanMsg, "user");
    } else {
      return;                               // rien à faire
    }

    /* ----- create conv on-the-fly (empty) ----- */
    let convId = conversationId;
    if (!convId) {
      const c = await createConversation("", convType);
      convId = c.conversationId;
      setConvId(convId);
    }

    /* ----- stream answer ----- */
    const wait = reserve("GPT 4o");
    let botId: number | undefined;
    let buffer = "";
    setStreaming(true);

    const launch = () => {
      streamRef.current = askQuestionStream(
        { question: cleanMsg, conversationId: convId!, conversationType: convType, modelId,useWeb: web},
        {
          onDelta: d => {
            buffer += d;
            if (botId === undefined) {
              botId = idRef.current++;
              setMessages(p => [...p, { id: botId!, text: d, sender: "bot" }]);
            } else {
              setMessages(p => p.map(m => (m.id === botId ? { ...m, text: buffer } : m)));
            }
          },
          onDone: () => setStreaming(false),
          onError: e => { console.error("Stream error :", e); setStreaming(false); },
        }
      );
    };

    wait ? setTimeout(launch, wait) : launch();
  };

  return (
    <div>
      <h2>Chat Documents</h2>
      <ChatMessages
            messages={messages}
            streaming={streaming}
            waitingForDoc={ingesting}
            generating={generating}     
            nbDocs={nbDocs}
          />
      <ChatInput
        onSend={handleSend}
        onStop={stopStream}
        streaming={streaming}
        disabled={ingesting}         
      />
    </div>
  );
};

export default DocumentsChat;
