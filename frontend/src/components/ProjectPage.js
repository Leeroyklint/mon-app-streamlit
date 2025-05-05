import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { askQuestion, createConversation, getMessages, getConversationsForProject, } from "../services/conversationService";
import { uploadProjectFiles, updateProjectInstructions, getProject, } from "../services/projectService";
import "./ProjectPage.css";
const ProjectPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    /* ---------- state ---------- */
    const [project, setProject] = useState();
    const [instructions, setInstructions] = useState("");
    const [instructionModal, setInstructionModal] = useState(false);
    const [newChatTitle, setNewChatTitle] = useState("");
    const [chats, setChats] = useState([]);
    const [conversationId, setConversationId] = useState();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    /* ---------- load project & chats ---------- */
    useEffect(() => {
        if (!projectId)
            return;
        (async () => {
            const p = await getProject(projectId);
            setProject(p);
            setInstructions(p.instructions || "");
            setChats(await getConversationsForProject(projectId));
        })();
    }, [projectId]);
    /* ---------- load messages ---------- */
    useEffect(() => {
        if (!conversationId)
            return;
        getMessages(conversationId).then((f) => setMessages(f.map((m, i) => ({
            id: i,
            text: m.content,
            sender: m.role === "assistant" ? "bot" : "user",
        }))));
    }, [conversationId]);
    const addMsg = (t, s) => setMessages((p) => [...p, { id: Date.now(), text: t, sender: s }]);
    /* ---------- new chat ---------- */
    const createNewChat = async () => {
        if (!projectId || !newChatTitle.trim())
            return;
        const res = await createConversation(newChatTitle, "project", projectId, instructions);
        const newConv = { id: res.conversationId, title: newChatTitle };
        setChats((prev) => [newConv, ...prev]);
        window.dispatchEvent(new CustomEvent("conversationCreated", { detail: { projectId, conversation: newConv } }));
        setNewChatTitle("");
        navigate(`/conversation/${newConv.id}`);
    };
    /* ---------- send ---------- */
    const handleSend = async (msg, files) => {
        if (!conversationId || !projectId || loading)
            return;
        setLoading(true);
        if (msg.trim())
            addMsg(msg, "user");
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
    const handleFileCard = async (e) => {
        if (!e.target.files || !projectId)
            return;
        const arr = Array.from(e.target.files);
        await uploadProjectFiles(projectId, arr);
        e.target.value = "";
        alert("Fichiers ajoutés !");
    };
    /* ---------- save instructions ---------- */
    const saveInstr = async () => {
        if (!projectId)
            return;
        await updateProjectInstructions(projectId, instructions);
        setInstructionModal(false);
    };
    /* ---------- UI ---------- */
    return (React.createElement("div", { style: { paddingLeft: 280, paddingTop: 24 } },
        React.createElement("h2", { style: { textAlign: "center", marginBottom: 24 } }, project?.name || "…"),
        !conversationId && (React.createElement("div", { className: "new-chat-bar" },
            React.createElement("input", { placeholder: "Nouveau chat dans ce projet", value: newChatTitle, onChange: (e) => setNewChatTitle(e.target.value), onKeyDown: (e) => e.key === "Enter" && createNewChat() }),
            React.createElement("button", { onClick: createNewChat }, "\uFF0B"))),
        !conversationId && (React.createElement("div", { className: "card-row" },
            React.createElement("label", { className: "card" },
                React.createElement("span", { className: "card-title" }, "Ajouter des fichiers"),
                React.createElement("span", { className: "card-desc" }, "Les chats de ce projet pourront acc\u00E9der au contenu"),
                React.createElement("input", { type: "file", multiple: true, style: { display: "none" }, onChange: handleFileCard })),
            React.createElement("div", { className: "card", onClick: () => setInstructionModal(true) },
                React.createElement("span", { className: "card-title" }, "Ajouter des instructions"),
                React.createElement("span", { className: "card-desc" }, "Personnalisez la mani\u00E8re dont GPT Klint r\u00E9pondra")))),
        !conversationId && (React.createElement("div", { className: "project-chat-list" },
            React.createElement("h3", null, "Chats dans ce projet"),
            React.createElement("ul", { style: { listStyle: "none", padding: 0 } },
                chats.map((c) => (React.createElement("li", { key: c.id, style: { cursor: "pointer", padding: "4px 0" }, onClick: () => navigate(`/conversation/${c.id}`) },
                    "\uD83D\uDDE8\uFE0F ",
                    c.title))),
                chats.length === 0 && (React.createElement("li", { style: { fontStyle: "italic" } }, "Aucun chat pour l\u2019instant."))))),
        conversationId && (React.createElement(React.Fragment, null,
            React.createElement(ChatMessages, { messages: messages }),
            React.createElement(ChatInput, { onSend: handleSend, disabled: loading }))),
        instructionModal && (React.createElement("div", { className: "modal-back", onClick: () => setInstructionModal(false) },
            React.createElement("div", { className: "modal-box", onClick: (e) => e.stopPropagation() },
                React.createElement("h3", null, "Instructions"),
                React.createElement("strong", { style: { fontSize: 14, lineHeight: 1.3 } }, "Comment GPT Klint peut\u2011il vous aider sur ce projet\u00A0?"),
                React.createElement("p", { style: { fontSize: 13, marginTop: 0 } }, "Vous pouvez demander \u00E0 GPT Klint de s\u2019int\u00E9resser \u00E0 certains th\u00E8mes, d\u2019utiliser un format pr\u00E9cis, etc."),
                React.createElement("textarea", { value: instructions, onChange: (e) => setInstructions(e.target.value) }),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { className: "cancel", onClick: () => setInstructionModal(false) }, "Annuler"),
                    React.createElement("button", { className: "save", onClick: saveInstr }, "Enregistrer")))))));
};
export default ProjectPage;
