import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import WelcomeScreen from "./WelcomeScreen";
import { askQuestionStream, getMessages, ApiError, } from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import { reserve } from "../services/rateLimiter";
import "./ChatApp.css";
import { useModel } from "../contexts/ModelContext";
const ChatApp = () => {
    /* ───────────────────────── routing ─────────────────────────── */
    const { conversationId: routeConvId } = useParams();
    const navigate = useNavigate();
    /* ───────────────────────── state ───────────────────────────── */
    const [conversationId, setConversationId] = useState(routeConvId);
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [nbDocs, setNbDocs] = useState(0);
    const idRef = useRef(0);
    const streamRef = useRef(null);
    const { modelId } = useModel();
    /* ───────────────────────── reset vers nouveau chat ─────────── */
    const resetToNewChat = () => {
        idRef.current = 0;
        setConversationId(undefined);
        setMessages([]);
        navigate("/");
    };
    /* ───────────────────────── changement d’URL ──────────────────
       Si l’ID change → on vide l’état local, il sera rechargé       */
    useEffect(() => {
        if (routeConvId && routeConvId !== conversationId) {
            idRef.current = 0;
            setConversationId(routeConvId);
            setMessages([]);
        }
    }, [routeConvId]);
    /* ───────────────────────── chargement historique ───────────── */
    useEffect(() => {
        if (conversationId && !ingesting && messages.length === 0) {
            load(conversationId);
        }
    }, [conversationId, ingesting, messages.length]);
    const load = async (convId) => {
        try {
            const hist = await getMessages(convId);
            setMessages(prev => {
                const sigPrev = new Set(prev.map(m => m.sender + "::" + m.text));
                const merged = [...prev];
                hist.forEach((m) => {
                    const sig = (m.role === "assistant" ? "bot::" : "user::") + m.content;
                    if (!sigPrev.has(sig)) {
                        merged.push({
                            id: idRef.current++,
                            text: m.content,
                            sender: m.role === "assistant" ? "bot" : "user",
                            attachments: m.attachments?.map((a) => ({
                                name: a.name,
                                type: a.type,
                                url: a.url || "",
                            })),
                        });
                    }
                });
                return merged;
            });
        }
        catch (e) {
            if (e instanceof ApiError && e.status === 404)
                resetToNewChat();
            else
                console.error("Erreur chargement messages :", e);
        }
    };
    /* ───────────────────────── reload auto quand conv MAJ ─────── */
    useEffect(() => {
        if (!conversationId)
            return;
        const reload = () => load(conversationId);
        window.addEventListener("conversationUpdated", reload);
        return () => window.removeEventListener("conversationUpdated", reload);
    }, [conversationId]);
    /* ───────────────────────── helpers UI ──────────────────────── */
    const add = (text, sender, atts) => setMessages(p => [
        ...p,
        { id: idRef.current++, text, sender, ...(atts ? { attachments: atts } : {}) },
    ]);
    const stopStream = () => {
        streamRef.current?.cancel();
        setStreaming(false);
    };
    /* ───────────────────────── envoi / upload ──────────────────── */
    const handleSend = async (userMessage, files) => {
        if (streaming || ingesting)
            return;
        let convId = conversationId;
        const cleanMsg = userMessage.trim();
        /* —— preview instantané si fichiers —— */
        let preview;
        if (files.length) {
            preview = files.map(f => ({
                name: f.name,
                url: URL.createObjectURL(f),
                type: f.type || "Document",
            }));
            add(cleanMsg, "user", preview);
            setIngesting(true);
            setNbDocs(files.length);
            try {
                const res = await uploadDocuments(files, convId);
                convId = res.conversationId;
                setConversationId(convId);
                if (!routeConvId)
                    navigate(`/conversation/${convId}`);
                window.dispatchEvent(new CustomEvent("conversationCreated"));
            }
            catch (e) {
                console.error("Upload error :", e);
            }
            finally {
                setIngesting(false);
                setNbDocs(0);
            }
        }
        else if (cleanMsg) {
            add(cleanMsg, "user");
        }
        /* — rien à streamer ? — */
        if (!cleanMsg)
            return;
        /* —— appel LLM en streaming —— */
        const wait = reserve("GPT 4o");
        let botId = null;
        let buffer = "";
        setStreaming(true);
        const launch = () => {
            streamRef.current = askQuestionStream({
                question: cleanMsg,
                ...(convId ? { conversationId: convId } : {}),
                conversationType: "chat",
                modelId,
            }, {
                onConvId: id => {
                    if (!conversationId) {
                        setConversationId(id);
                        window.dispatchEvent(new CustomEvent("conversationCreated"));
                        if (!routeConvId)
                            navigate(`/conversation/${id}`);
                    }
                },
                onDelta: chunk => {
                    buffer += chunk;
                    if (botId === null) {
                        const newId = idRef.current++;
                        botId = newId;
                        setMessages(p => [...p, { id: newId, text: chunk, sender: "bot" }]);
                    }
                    else {
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
            });
        };
        wait ? setTimeout(launch, wait) : launch();
    };
    /* ───────────────────────── render ──────────────────────────── */
    const landing = !conversationId && messages.length === 0;
    return (React.createElement("div", { style: { position: "relative" } }, landing ? (React.createElement(WelcomeScreen, { onSend: handleSend, disabled: streaming || ingesting })) : (React.createElement(React.Fragment, null,
        React.createElement(ChatMessages, { messages: messages, streaming: streaming, waitingForDoc: ingesting, nbDocs: nbDocs }),
        React.createElement(ChatInput, { onSend: handleSend, onStop: stopStream, streaming: streaming, disabled: ingesting, variant: "bottom" })))));
};
export default ChatApp;
