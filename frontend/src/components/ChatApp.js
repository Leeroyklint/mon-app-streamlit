// src/components/ChatApp.tsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { askQuestion, getMessages, createConversation, ApiError, } from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import "./ChatApp.css";
const ChatApp = () => {
    const { conversationId: routeConvId } = useParams();
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState(routeConvId);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const idCounterRef = useRef(0);
    const resetToNewChat = () => {
        setConversationId(undefined);
        setMessages([]);
        navigate("/");
    };
    /* ---------- chargement historique ---------- */
    useEffect(() => {
        if (routeConvId && !ingesting)
            loadMessages(routeConvId);
    }, [routeConvId, ingesting]);
    const loadMessages = async (convId) => {
        try {
            const fetched = await getMessages(convId);
            setMessages(fetched.map((m, idx) => ({
                id: idx,
                text: m.content,
                sender: m.role === "assistant" ? "bot" : "user",
                attachments: m.attachments?.map((att) => ({
                    name: att.name,
                    type: att.type,
                    url: att.url || "",
                })),
            })));
        }
        catch (e) {
            if (e instanceof ApiError && e.status === 404)
                resetToNewChat();
            else
                console.error("Erreur chargement messages :", e);
        }
    };
    const addMessage = (text, sender, attachments) => {
        const id = idCounterRef.current++;
        setMessages((prev) => [
            ...prev,
            { id, text, sender, ...(attachments ? { attachments } : {}) },
        ]);
    };
    /* ---------- envoi ---------- */
    const handleSend = async (userMessage, files) => {
        if (isLoading || ingesting)
            return;
        setIsLoading(true);
        let convId = conversationId;
        const convType = "chat";
        let previewAtch;
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
                if (!routeConvId)
                    navigate(`/conversation/${convId}`);
            }
            catch (e) {
                console.error("Upload error :", e);
            }
        }
        /* ----- affichage local message utilisateur ----- */
        if (userMessage || previewAtch) {
            addMessage(userMessage || "", "user", previewAtch);
        }
        /* ----- création de conversation (chat simple) ----- */
        if (!convId && files.length === 0) {
            try {
                const newConv = await createConversation(userMessage, convType);
                convId = newConv.conversationId;
                setConversationId(convId);
                addMessage(newConv.answer, "bot");
                /* ⬇️ notifie la sidebar pour ajout instantané -------- */
                window.dispatchEvent(new CustomEvent("conversationCreated"));
                navigate(`/conversation/${convId}`);
            }
            catch (e) {
                console.error("Échec création conv :", e);
            }
            finally {
                setIsLoading(false);
            }
            return;
        }
        /* ----- fonction d’envoi LLM ----- */
        const sendQuestion = async () => {
            if (userMessage.trim()) {
                try {
                    const answer = await askQuestion(userMessage, convId, convType);
                    addMessage(answer, "bot");
                }
                catch (e) {
                    if (e instanceof ApiError && e.status === 404) {
                        alert("Cette conversation n’existe plus, un nouveau chat va être créé.");
                        resetToNewChat();
                    }
                    else {
                        console.error("Erreur envoi message :", e);
                        addMessage("Erreur lors de l'envoi du message.", "bot");
                    }
                }
            }
            setIsLoading(false);
            setIngesting(false);
        };
        files.length > 0 ? setTimeout(sendQuestion, 5000) : await sendQuestion();
    };
    /* ---------- rendu ---------- */
    return (React.createElement("div", { style: { position: "relative" } },
        ingesting && (React.createElement("div", { className: "loading-overlay" },
            React.createElement("div", { className: "loader" }),
            React.createElement("p", null, "Indexation du document\u2026"))),
        isLoading && !ingesting && (React.createElement("div", { className: "loading-overlay" },
            React.createElement("div", { className: "loader" }),
            React.createElement("p", null, "GPT r\u00E9dige une r\u00E9ponse\u2026"))),
        React.createElement(ChatMessages, { messages: messages }),
        React.createElement(ChatInput, { onSend: handleSend, disabled: isLoading || ingesting })));
};
export default ChatApp;
