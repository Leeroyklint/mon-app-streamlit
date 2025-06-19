import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatInput      from "./ChatInput";
import ChatMessages   from "./ChatMessages";
import {
  askQuestionStream,
  createConversation,
  getMessages,
  getConversationsForProject,
} from "../services/conversationService";
import {
  uploadProjectFiles,
  updateProjectInstructions,
  getProject,
} from "../services/projectService";
import { reserve } from "../services/rateLimiter";
import { Message, Attachment } from "../interfaces/interfaces";
import "./ProjectPage.css";
import { useModel } from "../contexts/ModelContext";
import { useWeb }   from "../contexts/WebContext"; 
import { createDocument }      from "../services/documentService";
import { detectDocRequest }    from "../utils/detectDocRequest";

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  /* ---------- state ---------- */
  const [project, setProject]         = useState<any>();
  const [instructions, setInstr]      = useState("");
  const [modal, setModal]             = useState(false);
  const [newChatTitle, setNewTitle]   = useState("");
  const [chats, setChats]             = useState<any[]>([]);
  const [conversationId, setConvId]   = useState<string>();
  const [messages, setMessages]       = useState<Message[]>([]);
  const [streaming, setStreaming]     = useState(false);
  const [loading,   setLoading]       = useState(false);
  const [generating, setGenerating] = useState(false);  
  const [ingesting, setIngesting]     = useState(false);
  const [nbDocs,    setNbDocs]        = useState(0);

  const idRef     = useRef(0);
  const streamRef = useRef<{ cancel: () => void } | null>(null);

  const { modelId } = useModel();
  const { web }     = useWeb();  

  /* ---------- load project & chats ---------- */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const p = await getProject(projectId);
      setProject(p);
      setInstr(p.instructions || "");
      setChats(await getConversationsForProject(projectId));
    })();
  }, [projectId]);

  /* ---------- load messages ---------- */
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

  /* ---------- helpers ---------- */
  const add = (t: string, s: "user" | "bot", atts?: Attachment[]) =>
    setMessages(p => [...p, { id: idRef.current++, text: t, sender: s, ...(atts ? {attachments: atts}:{}) }]);

  const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };

  /* ---------- new chat ---------- */
  const createNewChat = async () => {
    if (!projectId || !newChatTitle.trim()) return;
    const res = await createConversation(newChatTitle, "chat", projectId, instructions);
    const newConv = { id: res.conversationId, title: newChatTitle };
    setChats(prev => [newConv, ...prev]);
    window.dispatchEvent(
      new CustomEvent("conversationCreated", { detail: { projectId, conversation: newConv } })
    );
    setNewTitle("");
    navigate(`/conversation/${newConv.id}`);
  };

  /* ---------- send ---------- */
  const handleSend = async (msg: string, files: File[]) => {
    if (!projectId || streaming || loading || ingesting) return;

    (window as any).___enableWeb = web; 

    setLoading(true);

    let convId = conversationId;
    const cleanMsg = msg.trim();

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

    /* ----- preview fichiers immédiatement ----- */
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
      await uploadProjectFiles(projectId, files);
      setIngesting(false);
      setNbDocs(0);
    } else if (cleanMsg) {
      add(cleanMsg, "user");
    }

    /* pas de question → stop */
    if (!cleanMsg) { setLoading(false); return; }

    /* ----- create conv if needed ----- */
    if (!convId) {
      const res = await createConversation("", "chat", projectId, instructions);
      convId = res.conversationId;
      setConvId(convId);
    }

    /* ----- stream answer ----- */
    const wait = reserve("GPT 4o");
    let botId: number | undefined;
    let buffer = "";
    setStreaming(true);

    const launch = () => {
      streamRef.current = askQuestionStream(
        {
          question: cleanMsg,
          conversationId: convId!,
          conversationType: "chat",
          instructions,
          modelId,
          useWeb: web,   
        },
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
          onDone: () => { setStreaming(false); setLoading(false); },
          onError: e => { console.error("Stream error :", e); setStreaming(false); setLoading(false); },
        }
      );
    };

    wait ? setTimeout(launch, wait) : launch();
  };

  /* ---------- UI ---------- */
  return (
    <div style={{ paddingLeft: 280, paddingTop: 24 }}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>{project?.name || "…"}</h2>

      {!conversationId && (
        <>
          {/* barre nouveau chat */}
          <div className="new-chat-bar">
            <input
              placeholder="Nouveau chat dans ce projet"
              value={newChatTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createNewChat()}
            />
            <button onClick={createNewChat}>＋</button>
          </div>

          {/* cartes fichier / instructions */}
          <div className="card-row">
            <label className="card">
              <span className="card-title">Ajouter des fichiers</span>
              <span className="card-desc">
                Les chats de ce projet pourront accéder au contenu
              </span>
              <input
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={e => {
                  if (!e.target.files) return;
                  uploadProjectFiles(projectId!, Array.from(e.target.files));
                }}
              />
            </label>

            <div className="card" onClick={() => setModal(true)}>
              <span className="card-title">Ajouter des instructions</span>
              <span className="card-desc">
                Personnalisez la manière dont GPT Klint répondra
              </span>
            </div>
          </div>

          {/* liste des chats */}
          <div className="project-chat-list">
            <h3>Chats dans ce projet</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {chats.map(c => (
                <li
                  key={c.id}
                  style={{ cursor: "pointer", padding: "4px 0" }}
                  onClick={() => navigate(`/conversation/${c.id}`)}
                >
                  🗨️ {c.title}
                </li>
              ))}
              {chats.length === 0 && (
                <li style={{ fontStyle: "italic" }}>Aucun chat pour l’instant.</li>
              )}
            </ul>
          </div>
        </>
      )}

      {conversationId && (
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
            disabled={loading || ingesting}   
          />
        </>
      )}

      {modal && (
        <div className="modal-back" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Instructions</h3>
            <strong style={{ fontSize: 14, lineHeight: 1.3 }}>
              Comment GPT Klint peut-il vous aider sur ce projet&nbsp;?
            </strong>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Vous pouvez demander un ton, un format, etc.
            </p>
            <textarea value={instructions} onChange={e => setInstr(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setModal(false)}>
                Annuler
              </button>
              <button
                className="save"
                onClick={async () => {
                  await updateProjectInstructions(projectId!, instructions);
                  setModal(false);
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
