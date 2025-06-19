import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProjects, deleteProject } from "../services/projectService";
import { getConversationsForProject, deleteConversation, } from "../services/conversationService";
import ConfirmModal from "./ConfirmModal";
import folderIcon from "../assets/folder.png"; // Importation de l'icône
import "./ProjectList.css";
const ProjectList = ({ onCreateProject }) => {
    /* ─────────── state ─────────── */
    const [projects, setProjects] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [convs, setConvs] = useState({});
    const [toDelete, setToDelete] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const currentConvId = location.pathname.startsWith("/conversation/")
        ? location.pathname.split("/")[2]
        : null;
    const currentProjId = location.pathname.startsWith("/projects/")
        ? location.pathname.split("/")[2]
        : null;
    /* ─────────── chargement projets ─────────── */
    const loadProjects = async () => {
        try {
            setProjects(await getProjects());
        }
        catch {
            console.error("Erreur chargement projets");
        }
    };
    useEffect(() => { loadProjects(); }, []);
    /* ─────────── listeners globaux ─────────── */
    useEffect(() => {
        const onProj = () => loadProjects();
        const onConv = (e) => {
            const { projectId, conversation } = e.detail || {};
            if (!projectId || !conversation)
                return;
            setExpanded(p => ({ ...p, [projectId]: true }));
            setConvs(p => {
                const list = p[projectId] || [];
                if (list.find(c => c.id === conversation.id))
                    return p;
                return { ...p, [projectId]: [conversation, ...list] };
            });
        };
        const onUpdate = () => {
            /* un titre ou message a changé → recharger si la conv appartient à un projet */
            Object.keys(convs).forEach(pid => ensureConvsLoaded(pid));
        };
        window.addEventListener("projectCreated", onProj);
        window.addEventListener("conversationCreated", onConv);
        window.addEventListener("conversationUpdated", onUpdate);
        return () => {
            window.removeEventListener("projectCreated", onProj);
            window.removeEventListener("conversationCreated", onConv);
            window.removeEventListener("conversationUpdated", onUpdate);
        };
    }, [convs]);
    /* ─────────── helpers ─────────── */
    const ensureConvsLoaded = async (projId) => {
        if (convs[projId])
            return;
        try {
            const list = await getConversationsForProject(projId);
            setConvs(prev => ({ ...prev, [projId]: list }));
        }
        catch {
            console.error("Erreur convs projet");
        }
    };
    const openProject = async (id) => {
        setExpanded(p => ({ ...p, [id]: !p[id] }));
        await ensureConvsLoaded(id);
        navigate(`/projects/${id}`);
    };
    /* ─────────── suppression ─────────── */
    const doDelete = async () => {
        if (!toDelete)
            return;
        try {
            if (toDelete.kind === "project") {
                await deleteProject(toDelete.id);
                loadProjects();
                if (toDelete.id === currentProjId) {
                    navigate("/");
                    window.location.reload();
                }
            }
            else {
                await deleteConversation(toDelete.id);
                setConvs(p => ({
                    ...p,
                    [toDelete.projectId]: p[toDelete.projectId].filter(c => c.id !== toDelete.id),
                }));
                if (toDelete.id === currentConvId) {
                    navigate("/");
                    window.location.reload();
                }
            }
        }
        catch {
            alert("Erreur suppression");
        }
        setToDelete(null);
    };
    /* ─────────── rendu ─────────── */
    if (projects.length === 0)
        return (
        // <div
        //   style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 4px" }}
        //   onClick={onCreateProject}
        // >
        //   <span style={{ fontSize:18 }}>📂</span> Nouveau projet
        // </div>
        React.createElement("button", { className: "sidebar-button", onClick: onCreateProject },
            React.createElement("img", { src: folderIcon, alt: "Nouveau Chat Icon", style: {
                    width: "18px",
                    height: "18px",
                    marginRight: "5px",
                    verticalAlign: "middle",
                } }),
            "Nouveau projet"));
    return (React.createElement(React.Fragment, null,
        React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } }, projects.map(p => (React.createElement("li", { key: p.id },
            React.createElement("div", { className: `sidebar-project-row ${currentProjId === p.id ? "active" : ""}`, onClick: () => openProject(p.id) },
                React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 6 } },
                    React.createElement("span", { style: { fontSize: 18 } },
                        React.createElement("img", { src: folderIcon, alt: "Nouveau Chat Icon", style: {
                                width: "18px",
                                height: "18px",
                                marginRight: "5px",
                                verticalAlign: "middle",
                            } })),
                    " ",
                    p.name),
                React.createElement("button", { className: "delete-btn", onClick: e => {
                        e.stopPropagation();
                        setToDelete({ kind: "project", id: p.id });
                    } }, "\u2013")),
            expanded[p.id] && (React.createElement("ul", { style: { listStyle: "none", paddingLeft: 24, marginBottom: 6 } },
                (convs[p.id] || []).map(c => (React.createElement("li", { key: c.id, className: `sidebar-list-item sidebar-sub-item ${c.id === currentConvId ? "active" : ""}`, onClick: () => navigate(`/conversation/${c.id}`) },
                    React.createElement("span", null, c.title?.slice(0, 20) || "Sans titre"),
                    React.createElement("button", { className: "delete-btn", onClick: e => {
                            e.stopPropagation();
                            setToDelete({ kind: "conv", id: c.id, projectId: p.id });
                        } }, "\u2013")))),
                convs[p.id] && convs[p.id].length === 0 && (React.createElement("li", { style: { fontStyle: "italic" } }, "Aucune conversation")))))))),
        React.createElement(ConfirmModal, { open: !!toDelete, title: "Supprimer ?", message: "Cette action est d\u00E9finitive.", onCancel: () => setToDelete(null), onConfirm: doDelete })));
};
export default ProjectList;
