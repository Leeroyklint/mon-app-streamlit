// src/components/ChatApp.tsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { Message, Attachment } from "../interfaces/interfaces";
import {
  askQuestion,
  getMessages,
  createConversation,
} from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import "./ChatApp.css";

const ChatApp: React.FC = () => {
  /* ---------- routing ---------- */
  const { conversationId: routeConvId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  /* ---------- state ---------- */
  const [conversationId, setConversationId] = useState<string | undefined>(
    routeConvId
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const idCounterRef = useRef(0);

  /* ---------- chargement historique ---------- */
  useEffect(() => {
    if (routeConvId && !ingesting) loadMessages(routeConvId);
  }, [routeConvId, ingesting]);

  const loadMessages = async (convId: string) => {
    try {
      const fetched = await getMessages(convId);
      setMessages(
        fetched.map((m: any, idx: number) => ({
          id: idx,
          text: m.content,
          sender: m.role === "assistant" ? "bot" : "user",
          attachments: m.attachments?.map((att: any) => ({
            name: att.name,
            type: att.type,
            url: att.url || "",
          })),
        }))
      );
    } catch (e) {
      console.error("Erreur chargement messages :", e);
    }
  };

  const addMessage = (
    text: string,
    sender: "user" | "bot",
    attachments?: Attachment[]
  ) => {
    const id = idCounterRef.current++;
    setMessages((prev) => [
      ...prev,
      { id, text, sender, ...(attachments ? { attachments } : {}) },
    ]);
  };

  /* ---------- envoi ---------- */
  const handleSend = async (userMessage: string, files: File[]) => {
    if (isLoading || ingesting) return;
    setIsLoading(true);

    let convId = conversationId;
    const convType = "chat";
    let previewAtch: Attachment[] | undefined;

    /* ----- upload fichiers ----- */
    if (files.length > 0) {
      setIngesting(true);
      try {
        const res = await uploadDocuments(files, convId);
        convId = res.conversationId;
        setConversationId(convId);
        previewAtch = files.map((f) => ({
          name: f.name,
          url: URL.createObjectURL(f),
          type: f.type || "Document",
        }));
        if (!routeConvId) navigate(`/conversation/${convId}`);
      } catch (e) {
        console.error("Upload error :", e);
      }
    }

    /* ----- affichage local message utilisateur ----- */
    if (userMessage || previewAtch) {
      addMessage(userMessage || "", "user", previewAtch);
    }

    /* ----- création de conversation vide (sans upload) ----- */
    if (!convId && files.length === 0) {
      try {
        const newConv = await createConversation(userMessage, convType);
        convId = newConv.conversationId;
        setConversationId(convId);
        addMessage(newConv.answer, "bot");
        if (!routeConvId) navigate(`/conversation/${convId}`);
      } catch (e) {
        console.error("Échec création conv :", e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    /* ----- fonction d’envoi LLM ----- */
    const sendQuestion = async () => {
      if (userMessage.trim()) {
        try {
          const answer = await askQuestion(userMessage, convId!, convType);
          addMessage(answer, "bot");
        } catch (e) {
          console.error("Erreur envoi message :", e);
          addMessage("Erreur lors de l'envoi du message.", "bot");
        }
      }
      setIsLoading(false);
      setIngesting(false);
    };

    /* ----- délai si upload ----- */
    if (files.length > 0) {
      setTimeout(sendQuestion, 5000);
    } else {
      await sendQuestion();
    }
  };

  /* ---------- rendu ---------- */
  return (
    <div style={{ position: "relative" }}>
      {/* overlay upload doc */}
      {ingesting && (
        <div className="loading-overlay">
          <div className="loader" />
          <p>Indexation du document…</p>
        </div>
      )}

      {/* overlay attente LLM */}
      {isLoading && !ingesting && (
        <div className="loading-overlay">
          <div className="loader" />
          <p>GPT rédige une réponse…</p>
        </div>
      )}

      <ChatMessages messages={messages} />
      <ChatInput onSend={handleSend} disabled={isLoading || ingesting} />
    </div>
  );
};

export default ChatApp;