import React, { useEffect, useState, useRef } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { askQuestionStream, createConversation, getMessages, } from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import { reserve } from "../services/rateLimiter";
import { useModel } from "../contexts/ModelContext";
const DocumentsChat = () => {
    const [conversationId, setConvId] = useState();
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [nbDocs, setNbDocs] = useState(0);
    const idRef = useRef(0);
    const streamRef = useRef(null);
    const { modelId } = useModel();
    useEffect(() => {
        if (!conversationId)
            return;
        getMessages(conversationId).then(f => setMessages(f.map((m, i) => ({
            id: i,
            text: m.content,
            sender: m.role === "assistant" ? "bot" : "user",
        }))));
    }, [conversationId]);
    const add = (t, s, atts) => setMessages(p => [...p, { id: idRef.current++, text: t, sender: s, ...(atts ? { attachments: atts } : {}) }]);
    const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };
    const handleSend = async (userMessage, files) => {
        if (streaming || ingesting)
            return;
        const convType = "doc";
        const cleanMsg = userMessage.trim();
        /* ----- fichiers -> preview immédiate ----- */
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
                const res = await uploadDocuments(files, conversationId);
                setConvId(res.conversationId);
            }
            finally {
                setIngesting(false);
                setNbDocs(0);
            }
            if (!cleanMsg)
                return; // pas de question -> on s’arrête là
        }
        else if (cleanMsg) {
            add(cleanMsg, "user");
        }
        else {
            return; // rien à faire
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
        let botId;
        let buffer = "";
        setStreaming(true);
        const launch = () => {
            streamRef.current = askQuestionStream({ question: cleanMsg, conversationId: convId, conversationType: convType, modelId }, {
                onDelta: d => {
                    buffer += d;
                    if (botId === undefined) {
                        botId = idRef.current++;
                        setMessages(p => [...p, { id: botId, text: d, sender: "bot" }]);
                    }
                    else {
                        setMessages(p => p.map(m => (m.id === botId ? { ...m, text: buffer } : m)));
                    }
                },
                onDone: () => setStreaming(false),
                onError: e => { console.error("Stream error :", e); setStreaming(false); },
            });
        };
        wait ? setTimeout(launch, wait) : launch();
    };
    return (React.createElement("div", null,
        React.createElement("h2", null, "Chat Documents"),
        React.createElement(ChatMessages, { messages: messages, streaming: streaming, waitingForDoc: ingesting, nbDocs: nbDocs }),
        React.createElement(ChatInput, { onSend: handleSend, onStop: stopStream, streaming: streaming, disabled: ingesting })));
};
export default DocumentsChat;
