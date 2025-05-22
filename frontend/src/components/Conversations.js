import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getConversations, deleteConversation, } from "../services/conversationService";
import ConfirmModal from "./ConfirmModal";
import "./Conversations.css";
const Conversations = () => {
    const [groups, setGroups] = useState({});
    const [error, setError] = useState("");
    const [toDelete, setToDelete] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const currentConvId = location.pathname.startsWith("/conversation/")
        ? location.pathname.split("/")[2]
        : null;
    /* ─────────── charge la liste depuis l’API ─────────── */
    const fetchConvs = async () => {
        try {
            const data = await getConversations();
            /* on élimine les convs liées à un projet pour cette liste “générale” */
            const clean = {};
            Object.entries(data).forEach(([grp, lst]) => {
                const l = lst.filter(c => !c.project_id);
                if (l.length)
                    clean[grp] = l;
            });
            setGroups(clean);
        }
        catch {
            setError("Erreur chargement conversations");
        }
    };
    /* ─────────── listeners (création + update) ─────────── */
    useEffect(() => {
        fetchConvs();
        const onNew = () => fetchConvs();
        const onUpdate = () => fetchConvs();
        window.addEventListener("conversationCreated", onNew);
        window.addEventListener("conversationUpdated", onUpdate);
        return () => {
            window.removeEventListener("conversationCreated", onNew);
            window.removeEventListener("conversationUpdated", onUpdate);
        };
    }, []);
    /* ─────────── suppression + redirection ─────────── */
    const confirmDelete = (id) => setToDelete(id);
    const reallyDelete = async () => {
        if (!toDelete)
            return;
        try {
            await deleteConversation(toDelete);
            await fetchConvs();
            if (toDelete === currentConvId) {
                navigate("/");
                window.location.reload();
            }
        }
        catch {
            alert("Erreur suppression conversation");
        }
        setToDelete(null);
    };
    /* ─────────── rendu ─────────── */
    if (error)
        return React.createElement("div", null, error);
    if (Object.keys(groups).length === 0)
        return null;
    const trunc = (t = "") => (t.length <= 15 ? t : t.slice(0, 15) + "…");
    return (React.createElement(React.Fragment, null,
        Object.entries(groups).map(([grp, convs]) => (React.createElement("div", { key: grp },
            React.createElement("h4", null, grp),
            React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } }, convs.map(c => (React.createElement("li", { key: c.id, className: `sidebar-list-item ${c.id === currentConvId ? "active" : ""}`, onClick: () => navigate(`/conversation/${c.id}`) },
                React.createElement("span", null, trunc(c.title)),
                React.createElement("button", { className: "delete-btn", onClick: e => {
                        e.stopPropagation();
                        confirmDelete(c.id);
                    } }, "\u2013")))))))),
        React.createElement(ConfirmModal, { open: !!toDelete, title: "Supprimer le chat ?", message: "Cette action est d\u00E9finitive.", onCancel: () => setToDelete(null), onConfirm: reallyDelete })));
};
export default Conversations;
