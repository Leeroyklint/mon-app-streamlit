import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProjects, deleteProject } from "../services/projectService";
import {
  getConversationsForProject,
  deleteConversation,
} from "../services/conversationService";
import ConfirmModal from "./ConfirmModal";
import folderIcon from "../assets/folder.png"; // Importation de l'icône
import "./ProjectList.css";

interface Props {
  onCreateProject: () => void;
}

type DelTarget =
  | { kind: "project"; id: string }
  | { kind: "conv"; id: string; projectId: string }
  | null;

const ProjectList: React.FC<Props> = ({ onCreateProject }) => {
  /* ─────────── state ─────────── */
  const [projects,  setProjects]  = useState<any[]>([]);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [convs,     setConvs]     = useState<Record<string, any[]>>({});
  const [toDelete,  setToDelete]  = useState<DelTarget>(null);

  const navigate   = useNavigate();
  const location   = useLocation();
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
    } catch {
      console.error("Erreur chargement projets");
    }
  };
  useEffect(() => { loadProjects(); }, []);

  /* ─────────── listeners globaux ─────────── */
  useEffect(() => {
    const onProj   = () => loadProjects();
    const onConv   = (e: any) => {
      const { projectId, conversation } = e.detail || {};
      if (!projectId || !conversation) return;
      setExpanded(p => ({ ...p, [projectId]: true }));
      setConvs(p => {
        const list = p[projectId] || [];
        if (list.find(c => c.id === conversation.id)) return p;
        return { ...p, [projectId]: [conversation, ...list] };
      });
    };
    const onUpdate = () => {
      /* un titre ou message a changé → recharger si la conv appartient à un projet */
      Object.keys(convs).forEach(pid => ensureConvsLoaded(pid));
    };

    window.addEventListener("projectCreated",     onProj);
    window.addEventListener("conversationCreated", onConv);
    window.addEventListener("conversationUpdated", onUpdate);

    return () => {
      window.removeEventListener("projectCreated",     onProj);
      window.removeEventListener("conversationCreated", onConv);
      window.removeEventListener("conversationUpdated", onUpdate);
    };
  }, [convs]);

  /* ─────────── helpers ─────────── */
  const ensureConvsLoaded = async (projId: string) => {
    if (convs[projId]) return;
    try {
      const list = await getConversationsForProject(projId);
      setConvs(prev => ({ ...prev, [projId]: list }));
    } catch {
      console.error("Erreur convs projet");
    }
  };

  const openProject = async (id: string) => {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
    await ensureConvsLoaded(id);
    navigate(`/projects/${id}`);
  };

  /* ─────────── suppression ─────────── */
  const doDelete = async () => {
    if (!toDelete) return;
    try {
      if (toDelete.kind === "project") {
        await deleteProject(toDelete.id);
        loadProjects();
        if (toDelete.id === currentProjId) {
          navigate("/");
          window.location.reload();
        }
      } else {
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
    } catch {
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
      <button 
        className="sidebar-button" 
        onClick={onCreateProject}>
        <img
          src={folderIcon}
          alt="Nouveau Chat Icon"
          style={{
            width: "18px",
            height: "18px",
            marginRight: "5px",
            verticalAlign: "middle",
          }}
        />
        Nouveau projet
      </button>
    );

  return (
    <>
      <ul style={{ listStyle:"none",padding:0,margin:0 }}>
        {projects.map(p => (
          <li key={p.id}>
            {/* —— ligne projet —— */}
            <div
              className={`sidebar-project-row ${currentProjId === p.id ? "active" : ""}`}
              onClick={() => openProject(p.id)}
            >
              <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:18 }}>
                  <img
                    src={folderIcon}
                    alt="Nouveau Chat Icon"
                    style={{
                      width: "18px",
                      height: "18px",
                      marginRight: "5px",
                      verticalAlign: "middle",
                    }}
                  />
                </span> {p.name}
              </span>
              <button
                className="delete-btn"
                onClick={e => {
                  e.stopPropagation();
                  setToDelete({ kind:"project", id:p.id });
                }}
              >–</button>
            </div>

            {/* —— sous-conversations —— */}
            {expanded[p.id] && (
              <ul style={{ listStyle:"none",paddingLeft:24,marginBottom:6 }}>
                {(convs[p.id] || []).map(c => (
                  <li
                    key={c.id}
                    className={`sidebar-list-item sidebar-sub-item ${
                      c.id === currentConvId ? "active" : ""
                    }`}
                    onClick={() => navigate(`/conversation/${c.id}`)}
                  >
                    <span>{c.title?.slice(0,20) || "Sans titre"}</span>
                    <button
                      className="delete-btn"
                      onClick={e => {
                        e.stopPropagation();
                        setToDelete({ kind:"conv", id:c.id, projectId:p.id });
                      }}
                    >–</button>
                  </li>
                ))}
                {convs[p.id] && convs[p.id].length === 0 && (
                  <li style={{ fontStyle:"italic" }}>Aucune conversation</li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {/* —— modal confirmation —— */}
      <ConfirmModal
        open={!!toDelete}
        title="Supprimer ?"
        message="Cette action est définitive."
        onCancel={() => setToDelete(null)}
        onConfirm={doDelete}
      />
    </>
  );
};

export default ProjectList;
