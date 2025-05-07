import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import WelcomeScreen from "./WelcomeScreen";
import { Message, Attachment } from "../interfaces/interfaces";
import {
  askQuestion,
  getMessages,
  createConversation,
  ApiError,
} from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import "./ChatApp.css";

const ChatApp: React.FC = () => {
  /* ---------- routing ---------- */
  const { conversationId: routeConvId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  /* ---------- state ---------- */
  const [conversationId, setConversationId] = useState<string | undefined>(routeConvId);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [ingesting, setIngesting]         = useState(false);
  const idCounterRef = useRef(0);

  const resetToNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    navigate("/");
  };

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
      if (e instanceof ApiError && e.status === 404) resetToNewChat();
      else console.error("Erreur chargement messages :", e);
    }
  };

  const addMessage = (
    text: string,
    sender: "user" | "bot",
    attachments?: Attachment[]
  ) => {
    const id = idCounterRef.current++;
    setMessages(prev => [
      ...prev,
      { id, text, sender, ...(attachments ? { attachments } : {}) },
    ]);
  };

  /* ---------- envoi ---------- */
  const handleSend = async (userMessage: string, files: File[]) => {
    if (isLoading || ingesting) return;
    setIsLoading(true);

    let convId   = conversationId;
    const convType = "chat";
    let previewAtch: Attachment[] | undefined;

    /* ----- upload fichiers ----- */
    if (files.length > 0) {
      setIngesting(true);
      try {
        const res = await uploadDocuments(files, convId);
        convId = res.conversationId;
        setConversationId(convId);
        previewAtch = files.map(f => ({
          name:f.name,
          url:URL.createObjectURL(f),
          type:f.type || "Document",
        }));
        if (!routeConvId) navigate(`/conversation/${convId}`);
      } catch (e) { console.error("Upload error :", e); }
    }

    /* ----- affichage local msg utilisateur ----- */
    if (userMessage || previewAtch) addMessage(userMessage || "", "user", previewAtch);

    /* ----- création de conv vide ----- */
    if (!convId && files.length === 0) {
      try {
        const newConv = await createConversation(userMessage, convType);
        convId = newConv.conversationId;
        setConversationId(convId);
        addMessage(newConv.answer, "bot");
        window.dispatchEvent(new CustomEvent("conversationCreated"));
        navigate(`/conversation/${convId}`);
      } catch (e) { console.error("Création conv :", e); }
      finally { setIsLoading(false); }
      return;
    }

    /* ----- envoi question LLM ----- */
    const sendQuestion = async () => {
      if (userMessage.trim()) {
        try {
          const answer = await askQuestion(userMessage, convId!, convType);
          addMessage(answer, "bot");
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) resetToNewChat();
          else {
            console.error("Erreur LLM :", e);
            addMessage("Erreur lors de l'envoi.", "bot");
          }
        }
      }
      setIsLoading(false);
      setIngesting(false);
    };

    files.length ? setTimeout(sendQuestion, 5000) : await sendQuestion();
  };

  /* ---------- rendu ---------- */
  const landing = !conversationId && messages.length === 0;

  return (
    <div style={{ position:"relative" }}>
      {ingesting && (
        <div className="loading-overlay">
          <div className="loader" />
          <p>Chargement du document…</p>
        </div>
      )}
      {isLoading && !ingesting && (
        <div className="loading-overlay">
          <div className="loader" />
          <p>GPT rédige une réponse…</p>
        </div>
      )}

      {landing ? (
        <WelcomeScreen onSend={handleSend} disabled={isLoading||ingesting} />
      ) : (
        <>
          <ChatMessages messages={messages} />
          <ChatInput
            onSend={handleSend}
            disabled={isLoading||ingesting}
            variant="bottom"
          />
        </>
      )}
    </div>
  );
};

export default ChatApp;
