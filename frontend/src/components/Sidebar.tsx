// Sidebar.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";
import Conversations from "./Conversations";
import ProjectList from "./ProjectList";
import { createProject } from "../services/projectService";
import klintIcon from "../assets/klint_icone.png"; // Importation de l'icône

interface SidebarProps {
  userName: string;
  onToggleSidebar: () => void; // (toujours dispo si tu l’utilises ailleurs)
}

const Sidebar: React.FC<SidebarProps> = ({ userName }) => {
  const navigate = useNavigate();

  /* ---------- état modal ---------- */
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");

  const openModal = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    setProjectName("");
    setProjectInstructions("");
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    try {
      const newProj = await createProject(projectName, projectInstructions);

      /* signale aux autres composants qu’un projet vient d’être créé */
      window.dispatchEvent(new CustomEvent("projectCreated"));

      closeModal();
      navigate(`/projects/${newProj.id}`);
    } catch (err) {
      console.error("Erreur création projet :", err);
    }
  };

  const handleNewChat = () => {
    navigate("/");
    window.location.reload();
  };

  return (
    <>
      {/* ==================   SIDEBAR   ================== */}
      <div className="sidebar">
        <div className="sidebar-user">
          <p>Bonjour, {userName}</p>
        </div>

        <div className="sidebar-section">
          <button className="sidebar-button" onClick={handleNewChat}>
            <img
              src={klintIcon}
              alt="Nouveau Chat Icon"
              style={{
                width: "30px",
                height: "30px",
                marginRight: "5px",
                verticalAlign: "middle",
              }}
            />
            Nouveau Chat
          </button>
        </div>

        {/* ------- section Projets ------- */}
        <div className="sidebar-section">
          <div className="sidebar-project-header">
            <span>Projets</span>
            <button className="sidebar-button-toggle" onClick={openModal}>
              +
            </button>
          </div>

          <ProjectList onCreateProject={openModal} />
        </div>

        <div className="sidebar-section">
          <Conversations />
        </div>
      </div>

      {/* ==================   MODAL   ================== */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()} /* stop bubbling */
          >
            <h3>Nouveau projet</h3>

            <input
              type="text"
              placeholder="Nom du projet"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />

            <textarea
              placeholder="Instructions (optionnel)"
              rows={4}
              value={projectInstructions}
              onChange={(e) => setProjectInstructions(e.target.value)}
            />

            <div className="actions">
              <button className="cancel-btn" onClick={closeModal}>
                Annuler
              </button>
              <button className="create-btn" onClick={handleCreateProject}>
                Créer le projet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;