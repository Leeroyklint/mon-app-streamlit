import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProjects, deleteProject } from "../services/projectService";
import {
  getConversationsForProject,
  deleteConversation,
} from "../services/conversationService";

interface Props {
  onCreateProject: () => void;
}

const ProjectList: React.FC<Props> = ({ onCreateProject }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [convs, setConvs] = useState<Record<string, any[]>>({});
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
    } catch {
      console.error("Erreur chargement projets");
    }
  };
  useEffect(() => { loadProjects(); }, []);

  /* ---------- évènements globaux ---------- */
  useEffect(() => {
    const onProj = () => loadProjects();
    window.addEventListener("projectCreated", onProj);

    const onConv = (e: any) => {
      const { projectId, conversation } = e.detail || {};
      if (!projectId || !conversation) return;
      setExpanded((p) => ({ ...p, [projectId]: true }));
      setConvs((p) => {
        const list = p[projectId] || [];
        /* évite d’empiler deux fois le même chat ----------------- */  // ★
        if (list.find((c) => c.id === conversation.id)) return p;      // ★
        return { ...p, [projectId]: [conversation, ...list] };         // ★
      });
    };
    window.addEventListener("conversationCreated", onConv);

    return () => {
      window.removeEventListener("projectCreated", onProj);
      window.removeEventListener("conversationCreated", onConv);
    };
  }, []);

  /* ---------- outils ---------- */
  const ensureConvsLoaded = async (projId: string) => {
    if (convs[projId]) return;      // déjà présent -> rien à faire
    try {
      /* on attend ici – dans une vraie fonction async            */
      const list = await getConversationsForProject(projId);
  
      /* puis on met l’état à jour sans mot‑clé await             */
      setConvs(prev => ({ ...prev, [projId]: list }));
    } catch {
      console.error("Err convs projet");
    }
  };

  const openProject = async (id: string) => {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
    await ensureConvsLoaded(id);
    navigate(`/projects/${id}`);
  };

  const delProj = async (id: string) => {
    await deleteProject(id);
    loadProjects();
  };

  const delConv = async (convId: string, projId: string) => {
    await deleteConversation(convId);
    setConvs(p => ({ ...p, [projId]: p[projId].filter(c => c.id !== convId) }));
  };

  /* ---------- affichage ---------- */
  if (projects.length === 0)
    return (
      <div
        style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 4px"}}
        onClick={onCreateProject}
      >
        <span style={{ fontSize:18 }}>📂</span> Nouveau projet
      </div>
    );

  return (
    <ul style={{ listStyle:"none",padding:0,margin:0 }}>
      {projects.map(p => (
        <li key={p.id}>
          {/* -------- ligne projet -------- */}
          <div
            className={`sidebar-project-row ${
              currentProjId === p.id ? "active" : ""
            }`}
            onClick={() => openProject(p.id)}
          >
            <span style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:18 }}>📂</span> {p.name}
            </span>
            <button className="delete-btn" onClick={e => { e.stopPropagation(); delProj(p.id); }}>–</button>
          </div>

          {/* -------- sous‑conversations -------- */}
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
                  <button className="delete-btn" onClick={e => { e.stopPropagation(); delConv(c.id,p.id); }}>–</button>
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
  );
};

export default ProjectList;
