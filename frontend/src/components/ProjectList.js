import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProjects, deleteProject } from "../services/projectService";
import { getConversationsForProject, deleteConversation, } from "../services/conversationService";
const ProjectList = ({ onCreateProject }) => {
    const [projects, setProjects] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [convs, setConvs] = useState({});
    const navigate = useNavigate();
    const location = useLocation();
    /* id conv / projet actuellement ouvert ------------------------ */
    const currentConvId = location.pathname.startsWith("/conversation/")
        ? location.pathname.split("/")[2]
        : null;
    const currentProjId = location.pathname.startsWith("/projects/")
        ? location.pathname.split("/")[2]
        : null;
    /* ---------- chargement projets ---------- */
    const loadProjects = async () => {
        try {
            setProjects(await getProjects());
        }
        catch {
            console.error("Erreur chargement projets");
        }
    };
    useEffect(() => { loadProjects(); }, []);
    /* ---------- évènements globaux ---------- */
    useEffect(() => {
        const onProj = () => loadProjects();
        window.addEventListener("projectCreated", onProj);
        const onConv = (e) => {
            const { projectId, conversation } = e.detail || {};
            if (!projectId || !conversation)
                return;
            setExpanded((p) => ({ ...p, [projectId]: true }));
            setConvs((p) => {
                const list = p[projectId] || [];
                /* évite d’empiler deux fois le même chat ----------------- */ // ★
                if (list.find((c) => c.id === conversation.id))
                    return p; // ★
                return { ...p, [projectId]: [conversation, ...list] }; // ★
            });
        };
        window.addEventListener("conversationCreated", onConv);
        return () => {
            window.removeEventListener("projectCreated", onProj);
            window.removeEventListener("conversationCreated", onConv);
        };
    }, []);
    /* ---------- outils ---------- */
    const ensureConvsLoaded = async (projId) => {
        if (convs[projId])
            return; // déjà présent -> rien à faire
        try {
            /* on attend ici – dans une vraie fonction async            */
            const list = await getConversationsForProject(projId);
            /* puis on met l’état à jour sans mot‑clé await             */
            setConvs(prev => ({ ...prev, [projId]: list }));
        }
        catch {
            console.error("Err convs projet");
        }
    };
    const openProject = async (id) => {
        setExpanded(p => ({ ...p, [id]: !p[id] }));
        await ensureConvsLoaded(id);
        navigate(`/projects/${id}`);
    };
    const delProj = async (id) => {
        await deleteProject(id);
        loadProjects();
    };
    const delConv = async (convId, projId) => {
        await deleteConversation(convId);
        setConvs(p => ({ ...p, [projId]: p[projId].filter(c => c.id !== convId) }));
    };
    /* ---------- affichage ---------- */
    if (projects.length === 0)
        return (React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 4px" }, onClick: onCreateProject },
            React.createElement("span", { style: { fontSize: 18 } }, "\uD83D\uDCC2"),
            " Nouveau projet"));
    return (React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } }, projects.map(p => (React.createElement("li", { key: p.id },
        React.createElement("div", { className: `sidebar-project-row ${currentProjId === p.id ? "active" : ""}`, onClick: () => openProject(p.id) },
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 6 } },
                React.createElement("span", { style: { fontSize: 18 } }, "\uD83D\uDCC2"),
                " ",
                p.name),
            React.createElement("button", { className: "delete-btn", onClick: e => { e.stopPropagation(); delProj(p.id); } }, "\u2013")),
        expanded[p.id] && (React.createElement("ul", { style: { listStyle: "none", paddingLeft: 24, marginBottom: 6 } },
            (convs[p.id] || []).map(c => (React.createElement("li", { key: c.id, className: `sidebar-list-item sidebar-sub-item ${c.id === currentConvId ? "active" : ""}`, onClick: () => navigate(`/conversation/${c.id}`) },
                React.createElement("span", null, c.title?.slice(0, 20) || "Sans titre"),
                React.createElement("button", { className: "delete-btn", onClick: e => { e.stopPropagation(); delConv(c.id, p.id); } }, "\u2013")))),
            convs[p.id] && convs[p.id].length === 0 && (React.createElement("li", { style: { fontStyle: "italic" } }, "Aucune conversation")))))))));
};
export default ProjectList;
