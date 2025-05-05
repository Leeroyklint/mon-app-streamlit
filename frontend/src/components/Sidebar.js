// Sidebar.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";
import Conversations from "./Conversations";
import ProjectList from "./ProjectList";
import { createProject } from "../services/projectService";
import klintIcon from "../assets/klint_icone.png"; // Importation de l'icône
const Sidebar = ({ userName }) => {
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
        if (!projectName.trim())
            return;
        try {
            const newProj = await createProject(projectName, projectInstructions);
            /* signale aux autres composants qu’un projet vient d’être créé */
            window.dispatchEvent(new CustomEvent("projectCreated"));
            closeModal();
            navigate(`/projects/${newProj.id}`);
        }
        catch (err) {
            console.error("Erreur création projet :", err);
        }
    };
    const handleNewChat = () => {
        navigate("/");
        window.location.reload();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "sidebar" },
            React.createElement("div", { className: "sidebar-user" },
                React.createElement("p", null,
                    "Bonjour, ",
                    userName)),
            React.createElement("div", { className: "sidebar-section" },
                React.createElement("button", { className: "sidebar-button", onClick: handleNewChat },
                    React.createElement("img", { src: klintIcon, alt: "Nouveau Chat Icon", style: {
                            width: "30px",
                            height: "30px",
                            marginRight: "5px",
                            verticalAlign: "middle",
                        } }),
                    "Nouveau Chat")),
            React.createElement("div", { className: "sidebar-section" },
                React.createElement("div", { className: "sidebar-project-header" },
                    React.createElement("span", null, "Projets"),
                    React.createElement("button", { className: "sidebar-button-toggle", onClick: openModal }, "+")),
                React.createElement(ProjectList, { onCreateProject: openModal })),
            React.createElement("div", { className: "sidebar-section" },
                React.createElement(Conversations, null))),
        showModal && (React.createElement("div", { className: "modal-overlay", onClick: closeModal },
            React.createElement("div", { className: "modal-box", onClick: (e) => e.stopPropagation() },
                React.createElement("h3", null, "Nouveau projet"),
                React.createElement("input", { type: "text", placeholder: "Nom du projet", value: projectName, onChange: (e) => setProjectName(e.target.value) }),
                React.createElement("textarea", { placeholder: "Instructions (optionnel)", rows: 4, value: projectInstructions, onChange: (e) => setProjectInstructions(e.target.value) }),
                React.createElement("div", { className: "actions" },
                    React.createElement("button", { className: "cancel-btn", onClick: closeModal }, "Annuler"),
                    React.createElement("button", { className: "create-btn", onClick: handleCreateProject }, "Cr\u00E9er le projet")))))));
};
export default Sidebar;
