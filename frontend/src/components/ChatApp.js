import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import WelcomeScreen from "./WelcomeScreen";
import { askQuestionStream, getMessages, ApiError, } from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import { reserve } from "../services/rateLimiter";
import "./ChatApp.css";
const ChatApp = () => {
    /* ── routing ── */
    const { conversationId: routeConvId } = useParams();
    const navigate = useNavigate();
    /* ── state ── */
    const [conversationId, setConversationId] = useState(routeConvId);
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [nbDocs, setNbDocs] = useState(0); // ← nb de docs en cours
    const idRef = useRef(0);
    const streamRef = useRef(null);
    const resetToNewChat = () => {
        idRef.current = 0;
        setConversationId(undefined);
        setMessages([]);
        navigate("/");
    };
    /* ── charge historique (merge) ── */
    useEffect(() => {
        if (routeConvId && !ingesting && messages.length === 0)
            load(routeConvId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeConvId, ingesting]);
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
    /* ── refresh auto quand conv mise à jour ── */
    useEffect(() => {
        if (!conversationId)
            return;
        const reload = () => load(conversationId);
        window.addEventListener("conversationUpdated", reload);
        return () => window.removeEventListener("conversationUpdated", reload);
    }, [conversationId]);
    /* ── helpers ── */
    const add = (text, sender, atts) => setMessages(p => [
        ...p,
        { id: idRef.current++, text, sender, ...(atts ? { attachments: atts } : {}) },
    ]);
    const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };
    /* ── send / upload ── */
    const handleSend = async (userMessage, files) => {
        if (streaming || ingesting)
            return;
        let convId = conversationId;
        const cleanMsg = userMessage.trim();
        /* ───────── preview immédiate si fichiers ───────── */
        let preview;
        if (files.length) {
            preview = files.map(f => ({
                name: f.name,
                url: URL.createObjectURL(f),
                type: f.type || "Document",
            }));
            add(cleanMsg, "user", preview); // bulle visible tout de suite
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
            /* pas de fichiers → bulle texte normale */
            add(cleanMsg, "user");
        }
        /* --- on ne stream que s’il y a vraiment un message texte --- */
        if (!cleanMsg)
            return;
        /* ───────── appel LLM ───────── */
        const wait = reserve("GPT 4o");
        let botId = null;
        let buffer = "";
        setStreaming(true);
        const launch = () => {
            streamRef.current = askQuestionStream({
                question: cleanMsg,
                ...(convId ? { conversationId: convId } : {}),
                conversationType: "chat",
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
    /* ── render ── */
    const landing = !conversationId && messages.length === 0;
    return (React.createElement("div", { style: { position: "relative" } }, landing ? (React.createElement(WelcomeScreen, { onSend: handleSend, disabled: streaming || ingesting })) : (React.createElement(React.Fragment, null,
        React.createElement(ChatMessages, { messages: messages, streaming: streaming, waitingForDoc: ingesting, nbDocs: nbDocs }),
        React.createElement(ChatInput, { onSend: handleSend, onStop: stopStream, streaming: streaming, disabled: ingesting, variant: "bottom" })))));
};
export default ChatApp;
