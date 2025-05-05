import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getConversations, deleteConversation, } from "../services/conversationService";
import "./Conversations.css";
const Conversations = () => {
    const [groups, setGroups] = useState({});
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentConvId = location.pathname.startsWith("/conversation/")
        ? location.pathname.split("/")[2]
        : null;
    /* -------- chargement + filtrage -------- */
    const fetchConvs = async () => {
        try {
            const data = await getConversations();
            const clean = {};
            Object.entries(data).forEach(([g, lst]) => {
                const l = lst.filter(c => !c.project_id); // ≠ chats de projets
                if (l.length)
                    clean[g] = l;
            });
            setGroups(clean);
        }
        catch {
            setError("Erreur chargement conversations");
        }
    };
    useEffect(() => {
        fetchConvs();
        const id = setInterval(fetchConvs, 5000);
        return () => clearInterval(id);
    }, []);
    /* -------- rendu -------- */
    if (error)
        return React.createElement("div", null, error);
    if (Object.keys(groups).length === 0)
        return null;
    const trunc = (t = "") => (t.length <= 15 ? t : t.slice(0, 15) + "…");
    return (React.createElement("div", null, Object.entries(groups).map(([grp, convs]) => (React.createElement("div", { key: grp },
        React.createElement("h4", null, grp),
        React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } }, convs.map(c => (React.createElement("li", { key: c.id, className: `sidebar-list-item ${c.id === currentConvId ? "active" : ""}`, onClick: () => navigate(`/conversation/${c.id}`) },
            React.createElement("span", null, trunc(c.title)),
            React.createElement("button", { className: "delete-btn", onClick: e => {
                    e.stopPropagation();
                    deleteConversation(c.id).then(fetchConvs);
                } }, "\u2013"))))))))));
};
export default Conversations;
