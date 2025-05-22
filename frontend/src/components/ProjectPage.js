import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { askQuestionStream, createConversation, getMessages, getConversationsForProject, } from "../services/conversationService";
import { uploadProjectFiles, updateProjectInstructions, getProject, } from "../services/projectService";
import { reserve } from "../services/rateLimiter";
import "./ProjectPage.css";
const ProjectPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    /* ---------- state ---------- */
    const [project, setProject] = useState();
    const [instructions, setInstr] = useState("");
    const [modal, setModal] = useState(false);
    const [newChatTitle, setNewTitle] = useState("");
    const [chats, setChats] = useState([]);
    const [conversationId, setConvId] = useState();
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [nbDocs, setNbDocs] = useState(0);
    const idRef = useRef(0);
    const streamRef = useRef(null);
    /* ---------- load project & chats ---------- */
    useEffect(() => {
        if (!projectId)
            return;
        (async () => {
            const p = await getProject(projectId);
            setProject(p);
            setInstr(p.instructions || "");
            setChats(await getConversationsForProject(projectId));
        })();
    }, [projectId]);
    /* ---------- load messages ---------- */
    useEffect(() => {
        if (!conversationId)
            return;
        getMessages(conversationId).then(f => setMessages(f.map((m, i) => ({
            id: i,
            text: m.content,
            sender: m.role === "assistant" ? "bot" : "user",
        }))));
    }, [conversationId]);
    /* ---------- helpers ---------- */
    const add = (t, s, atts) => setMessages(p => [...p, { id: idRef.current++, text: t, sender: s, ...(atts ? { attachments: atts } : {}) }]);
    const stopStream = () => { streamRef.current?.cancel(); setStreaming(false); };
    /* ---------- new chat ---------- */
    const createNewChat = async () => {
        if (!projectId || !newChatTitle.trim())
            return;
        const res = await createConversation(newChatTitle, "project", projectId, instructions);
        const newConv = { id: res.conversationId, title: newChatTitle };
        setChats(prev => [newConv, ...prev]);
        window.dispatchEvent(new CustomEvent("conversationCreated", { detail: { projectId, conversation: newConv } }));
        setNewTitle("");
        navigate(`/conversation/${newConv.id}`);
    };
    /* ---------- send ---------- */
    const handleSend = async (msg, files) => {
        if (!projectId || streaming || loading || ingesting)
            return;
        setLoading(true);
        let convId = conversationId;
        const cleanMsg = msg.trim();
        /* ----- preview fichiers immédiatement ----- */
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
            await uploadProjectFiles(projectId, files);
            setIngesting(false);
            setNbDocs(0);
        }
        else if (cleanMsg) {
            add(cleanMsg, "user");
        }
        /* pas de question → stop */
        if (!cleanMsg) {
            setLoading(false);
            return;
        }
        /* ----- create conv if needed ----- */
        if (!convId) {
            const res = await createConversation("", "project", projectId, instructions);
            convId = res.conversationId;
            setConvId(convId);
        }
        /* ----- stream answer ----- */
        const wait = reserve("GPT 4o");
        let botId;
        let buffer = "";
        setStreaming(true);
        const launch = () => {
            streamRef.current = askQuestionStream({ question: cleanMsg, conversationId: convId, conversationType: "project", instructions }, {
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
                onDone: () => { setStreaming(false); setLoading(false); },
                onError: e => { console.error("Stream error :", e); setStreaming(false); setLoading(false); },
            });
        };
        wait ? setTimeout(launch, wait) : launch();
    };
    /* ---------- UI ---------- */
    return (React.createElement("div", { style: { paddingLeft: 280, paddingTop: 24 } },
        React.createElement("h2", { style: { textAlign: "center", marginBottom: 24 } }, project?.name || "…"),
        !conversationId && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "new-chat-bar" },
                React.createElement("input", { placeholder: "Nouveau chat dans ce projet", value: newChatTitle, onChange: e => setNewTitle(e.target.value), onKeyDown: e => e.key === "Enter" && createNewChat() }),
                React.createElement("button", { onClick: createNewChat }, "\uFF0B")),
            React.createElement("div", { className: "card-row" },
                React.createElement("label", { className: "card" },
                    React.createElement("span", { className: "card-title" }, "Ajouter des fichiers"),
                    React.createElement("span", { className: "card-desc" }, "Les chats de ce projet pourront acc\u00E9der au contenu"),
                    React.createElement("input", { type: "file", multiple: true, style: { display: "none" }, onChange: e => {
                            if (!e.target.files)
                                return;
                            uploadProjectFiles(projectId, Array.from(e.target.files));
                        } })),
                React.createElement("div", { className: "card", onClick: () => setModal(true) },
                    React.createElement("span", { className: "card-title" }, "Ajouter des instructions"),
                    React.createElement("span", { className: "card-desc" }, "Personnalisez la mani\u00E8re dont GPT Klint r\u00E9pondra"))),
            React.createElement("div", { className: "project-chat-list" },
                React.createElement("h3", null, "Chats dans ce projet"),
                React.createElement("ul", { style: { listStyle: "none", padding: 0 } },
                    chats.map(c => (React.createElement("li", { key: c.id, style: { cursor: "pointer", padding: "4px 0" }, onClick: () => navigate(`/conversation/${c.id}`) },
                        "\uD83D\uDDE8\uFE0F ",
                        c.title))),
                    chats.length === 0 && (React.createElement("li", { style: { fontStyle: "italic" } }, "Aucun chat pour l\u2019instant.")))))),
        conversationId && (React.createElement(React.Fragment, null,
            React.createElement(ChatMessages, { messages: messages, streaming: streaming, waitingForDoc: ingesting, nbDocs: nbDocs }),
            React.createElement(ChatInput, { onSend: handleSend, onStop: stopStream, streaming: streaming, disabled: loading || ingesting }))),
        modal && (React.createElement("div", { className: "modal-back", onClick: () => setModal(false) },
            React.createElement("div", { className: "modal-box", onClick: e => e.stopPropagation() },
                React.createElement("h3", null, "Instructions"),
                React.createElement("strong", { style: { fontSize: 14, lineHeight: 1.3 } }, "Comment GPT Klint peut-il vous aider sur ce projet\u00A0?"),
                React.createElement("p", { style: { fontSize: 13, marginTop: 0 } }, "Vous pouvez demander un ton, un format, etc."),
                React.createElement("textarea", { value: instructions, onChange: e => setInstr(e.target.value) }),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { className: "cancel", onClick: () => setModal(false) }, "Annuler"),
                    React.createElement("button", { className: "save", onClick: async () => {
                            await updateProjectInstructions(projectId, instructions);
                            setModal(false);
                        } }, "Enregistrer")))))));
};
export default ProjectPage;
