// ChatApp.tsx
import React, { useState, useRef, useEffect } from "react";
import { useWeb }      from "../contexts/WebContext";
import { useParams, useNavigate } from "react-router-dom";

import ChatInput      from "./ChatInput";
import ChatMessages   from "./ChatMessages";
import WelcomeScreen  from "./WelcomeScreen";

import { Message, Attachment } from "../interfaces/interfaces";
import {
  askQuestionStream,
  getMessages,
  ApiError,
} from "../services/conversationService";
import { uploadDocuments }     from "../services/documentService";
import { reserve }             from "../services/rateLimiter";
import { generateImage }       from "../services/imageService";
import { isImagePrompt }       from "../utils/isImagePrompt";
import { useModel }            from "../contexts/ModelContext";
import { createDocument }      from "../services/documentService";
import { detectDocRequest }    from "../utils/detectDocRequest";

import "./ChatApp.css";

/* ------------------------------------------------------------- */
/*                           COMPONENT                           */
/* ------------------------------------------------------------- */
const ChatApp: React.FC = () => {
  /* ─── routing ──────────────────────────────────────────────── */
  const { conversationId: routeConvId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  /* ─── state ───────────────────────────────────────────────── */
  const [conversationId, setConversationId] = useState<string | undefined>(routeConvId);

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [streaming,  setStreaming]  = useState(false);
  const [ingesting,  setIngesting]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [nbDocs,     setNbDocs]     = useState(0);

  const idRef     = useRef(0);
  const streamRef = useRef<{ cancel: () => void } | null>(null);

  const { modelId } = useModel();
  const { web }     = useWeb();   

  /* ─── helpers UI ──────────────────────────────────────────── */
  const add = (text: string, sender: "user" | "bot", atts?: Attachment[]) =>
    setMessages(p => [
      ...p,
      { id: idRef.current++, text, sender, ...(atts ? { attachments: atts } : {}) },
    ]);

  const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };

  const resetToNewChat = () => {
    idRef.current = 0;
    setConversationId(undefined);
    setMessages([]);
    navigate("/");
  };

  /* ----------------------------------------------------------- */
  /*                  HISTORY - LOAD / RELOAD                    */
  /* ----------------------------------------------------------- */
  const load = async (convId?: string) => {          // <── convId peut être undefined
    if (!convId) return;                            // rien à faire
    try {
      const hist: any[] = await getMessages(convId);

      const seen  = new Set<string>();
      const msgs: Message[] = [];

      hist.forEach((m, i) => {
        const sig = `${m.role}:${m.content}:${
          m.attachments?.map((a: any) => a.url).join("|") || "-"
        }`;
        if (seen.has(sig)) return;
        seen.add(sig);

        msgs.push({
          id: i,
          text: m.content,
          sender: m.role === "assistant" ? "bot" : "user",
          attachments: m.attachments?.map((a: any) => ({
            name: a.name,
            type: a.type,
            url:  a.url || "",
          })),
        });
      });

      setMessages(msgs);
      idRef.current = msgs.length;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) resetToNewChat();
      else console.error("Erreur chargement messages :", e);
    }
  };

  /* --- quand l’URL change ----------------------------------- */
  useEffect(() => {
    if (routeConvId && routeConvId !== conversationId) {
      setConversationId(routeConvId);
      load(routeConvId);
    }
  }, [routeConvId]);

  /* --- premier chargement ----------------------------------- */
  useEffect(() => {
    if (conversationId && messages.length === 0) load(conversationId);
  }, [conversationId, messages.length]);

  /* --- reload auto quand backend signale maj ----------------- */
  useEffect(() => {
    if (!conversationId) return;
    const reload = () => load(conversationId);
    window.addEventListener("conversationUpdated", reload);
    return () => window.removeEventListener("conversationUpdated", reload);
  }, [conversationId]);

  /* ----------------------------------------------------------- */
  /*                        HANDLE  SEND                         */
  /* ----------------------------------------------------------- */
  const handleSend = async (userMessage: string, files: File[]) => {
    if (streaming || ingesting || generating) return;

    // ── active / désactive la recherche Web pour cette requête
    (window as any).___enableWeb = web;           

    let convId = conversationId;
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

    /* ---------- upload fichiers (= chat doc) -------------- */
    if (files.length) {
      const preview = files.map(f => ({
        name: f.name, url: URL.createObjectURL(f), type: f.type || "Document",
      }));
      add(cleanMsg, "user", preview);

      setIngesting(true); setNbDocs(files.length);
      try {
        const res = await uploadDocuments(files, convId);
        convId = res.conversationId;
        setConversationId(convId);
        if (!routeConvId) navigate(`/conversation/${convId}`);
        window.dispatchEvent(new CustomEvent("conversationCreated"));
      } catch (e) { console.error("Upload error :", e); }
      finally      { setIngesting(false); setNbDocs(0); }
    } else if (cleanMsg) {
      add(cleanMsg, "user");
    }

    // /* ---------- 1. génération d’image ------------------------ */
    // if (cleanMsg && isImagePrompt(cleanMsg)) {
    //   try {
    //     setGenerating(true);
    //     const { url, conversationId: newId } = await generateImage(cleanMsg, convId);
        
    //     if (!convId) {                         // nouvelle conv créée par le back
    //       convId = newId;
    //       setConversationId(newId);
    //       if (!routeConvId) navigate(`/conversation/${newId}`);
    //       window.dispatchEvent(new CustomEvent("conversationCreated"));
    //     } else {
    //       window.dispatchEvent(new CustomEvent("conversationUpdated"));
    //     }

    //     add("Voici l’image :", "bot", [
    //       { name: "image.png", url, type: "image/png" },
    //     ]);

    //     load(convId);
    //   } catch (e) {
    //     console.error("Image generation error :", e);
    //     const msg = (e as Error).message.includes("politique")
    //       ? "❌ Désolé, ce prompt n’est pas autorisé."
    //       : "⚠️ Erreur lors de la génération d’image.";
    //     add(msg, "bot");
    //   } finally {
    //     setGenerating(false);
    //   }
    //   return;
    // }

    /* ---------- 2. rien à streamer ? ------------------------- */
    if (!cleanMsg) return;

    /* ---------- 3. stream LLM ------------------------------- */
    const wait = reserve("GPT 4o");
    let botId: number | null = null;
    let buffer = "";
    setStreaming(true);

    const launch = () => {
      streamRef.current = askQuestionStream(
        {
          question: cleanMsg,
          ...(convId ? { conversationId: convId } : {}),
          conversationType: "chat",
          modelId,
          useWeb: web,
        },
        {
          onConvId: id => {
            if (!conversationId) {
              setConversationId(id);
              window.dispatchEvent(new CustomEvent("conversationCreated"));
              if (!routeConvId) navigate(`/conversation/${id}`);
            }
          },
          onDelta: chunk => {
            buffer += chunk;
            if (botId === null) {
              const newId = idRef.current++;
              botId = newId;
              setMessages(p => [...p, { id: newId, text: chunk, sender: "bot" }]);
            } else {
              setMessages(p => p.map(m => (m.id === botId ? { ...m, text: buffer } : m)));
            }
          },
          onDone: () => {
            setStreaming(false);
            window.dispatchEvent(new CustomEvent("conversationUpdated"));
          },
          onError: e => {
            console.error("Stream error :", e);
            setStreaming(false);
          },
        }
      );
    };
    wait ? setTimeout(launch, wait) : launch();
  };

  /* ----------------------------------------------------------- */
  /*                          RENDER                             */
  /* ----------------------------------------------------------- */
  const landing = !conversationId && messages.length === 0;

  return (
    <div style={{ position: "relative" }}>
      {landing ? (
        <WelcomeScreen
          onSend={handleSend}
          disabled={streaming || ingesting || generating}
        />
      ) : (
        <>
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
            disabled={ingesting || generating}
            variant="bottom"
          />
        </>
      )}
    </div>
  );
};

export default ChatApp;
