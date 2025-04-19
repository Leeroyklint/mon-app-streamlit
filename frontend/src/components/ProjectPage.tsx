import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import {
  askQuestion,
  createConversation,
  getMessages,
  getConversationsForProject,
} from "../services/conversationService";
import {
  uploadProjectFiles,
  updateProjectInstructions,
  getProject,
} from "../services/projectService";
import { Message } from "../interfaces/interfaces";
import "./ProjectPage.css";

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  /* ---------- state ---------- */
  const [project, setProject] = useState<any>();
  const [instructions, setInstructions] = useState("");
  const [instructionModal, setInstructionModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [chats, setChats] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------- load project & chats ---------- */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const p = await getProject(projectId);
      setProject(p);
      setInstructions(p.instructions || "");
      setChats(await getConversationsForProject(projectId));
    })();
  }, [projectId]);

  /* ---------- load messages ---------- */
  useEffect(() => {
    if (!conversationId) return;
    getMessages(conversationId).then((f) =>
      setMessages(
        f.map((m: any, i: number) => ({
          id: i,
          text: m.content,
          sender: m.role === "assistant" ? "bot" : "user",
        }))
      )
    );
  }, [conversationId]);

  const addMsg = (t: string, s: "user" | "bot") =>
    setMessages((p) => [...p, { id: Date.now(), text: t, sender: s }]);

  /* ---------- new chat ---------- */
  const createNewChat = async () => {
    if (!projectId || !newChatTitle.trim()) return;
    const res = await createConversation(
      newChatTitle,
      "project",
      projectId,
      instructions
    );
    const newConv = { id: res.conversationId, title: newChatTitle };
    setChats((prev) => [newConv, ...prev]);
    window.dispatchEvent(
      new CustomEvent("conversationCreated", { detail: { projectId, conversation: newConv } })
    );
    setNewChatTitle("");
    navigate(`/conversation/${newConv.id}`);
  };

  /* ---------- send ---------- */
  const handleSend = async (msg: string, files: File[]) => {
    if (!conversationId || !projectId || loading) return;
    setLoading(true);
    if (msg.trim()) addMsg(msg, "user");
    if (files.length) {
      await uploadProjectFiles(projectId, files);
      addMsg(`Fichiers : ${files.map((f) => f.name).join(", ")}`, "user");
    }
    if (msg.trim()) {
      const ans = await askQuestion(msg, conversationId, "project", instructions);
      addMsg(ans, "bot");
    }
    setLoading(false);
  };

  /* ---------- upload depuis carte ---------- */
  const handleFileCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !projectId) return;
    const arr = Array.from(e.target.files);
    await uploadProjectFiles(projectId, arr);
    (e.target as HTMLInputElement).value = "";
    alert("Fichiers ajoutés !");
  };

  /* ---------- save instructions ---------- */
  const saveInstr = async () => {
    if (!projectId) return;
    await updateProjectInstructions(projectId, instructions);
    setInstructionModal(false);
  };

  /* ---------- UI ---------- */
  return (
    <div style={{ paddingLeft: 280, paddingTop: 24 }}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>
        {project?.name || "…"}
      </h2>

      {/* --- barre nouveau chat --- */}
      {!conversationId && (
        <div className="new-chat-bar">
          <input
            placeholder="Nouveau chat dans ce projet"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNewChat()}
          />
          <button onClick={createNewChat}>＋</button>
        </div>
      )}

      {/* --- cartes fichier / instructions --- */}
      {!conversationId && (
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
              onChange={handleFileCard}
            />
          </label>

          <div className="card" onClick={() => setInstructionModal(true)}>
            <span className="card-title">Ajouter des instructions</span>
            <span className="card-desc">
              Personnalisez la manière dont GPT Klint répondra
            </span>
          </div>
        </div>
      )}

      {/* --- liste des chats --- */}
      {!conversationId && (
        <div className="project-chat-list">
          <h3>Chats dans ce projet</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {chats.map((c) => (
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
      )}

      {/* --- chat actif --- */}
      {conversationId && (
        <>
          <ChatMessages messages={messages} />
          <ChatInput onSend={handleSend} disabled={loading} />
        </>
      )}

      {/* --- modal instructions --- */}
      {instructionModal && (
        <div className="modal-back" onClick={() => setInstructionModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Instructions</h3>
            <strong style={{ fontSize: 14, lineHeight: 1.3 }}>
              Comment GPT Klint peut‑il vous aider sur ce projet&nbsp;?
            </strong>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Vous pouvez demander à GPT Klint de s’intéresser à certains thèmes, d’utiliser un
              format précis, etc.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setInstructionModal(false)}>
                Annuler
              </button>
              <button className="save" onClick={saveInstr}>
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
