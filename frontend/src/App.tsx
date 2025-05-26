// App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import ChatApp from "./components/ChatApp";
import DocumentsChat from "./components/DocumentsChat";
import ProjectPage from "./components/ProjectPage";
import Sidebar from "./components/Sidebar";
import AIModelSelector from "./components/AIModelSelector";
import { getCurrentUser, User } from "./services/userService";
import { ModelProvider, useModel } from "./contexts/ModelContext";
import "./App.css";

/* ─── liste des modèles affichés ─────────────────────────────── */
const models = [
  { id: "GPT 4o",       name: "GPT 4o",       subtitle: "Tâches quotidiennes, rapide" },
  { id: "GPT 4o-mini",  name: "GPT 4o-mini",  subtitle: "Ultra léger, idéal tâches simples" },
  { id: "GPT o1",       name: "GPT o1",       subtitle: "Polyvalent, raisonnement ++" },
  { id: "GPT o1-mini",  name: "GPT o1-mini",  subtitle: "Léger mais plus malin" },
  { id: "GPT 4.1",      name: "GPT 4.1",      subtitle: "Avancé et rapide" },
  { id: "GPT 4.1-mini", name: "GPT 4.1-mini", subtitle: "Très rapide et capable" },
  { id: "GPT o3-mini",  name: "GPT o3-mini",  subtitle: "Performances pour devs" },
];

/* ─── composant interne : toute la logique UI ────────────────── */
function AppInner() {
  const [userName, setUserName] = useState("Chargement…");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  /* modèle sélectionné (contexte) */
  const { modelId, setModelId } = useModel();

  /* user courant */
  useEffect(() => {
    getCurrentUser()
      .then((u: User) => setUserName(u.name))
      .catch(() => setUserName("Utilisateur inconnu"));
  }, []);

  const toggleSidebar = () => setSidebarVisible(p => !p);

  return (
    <div className="App">
      {/* sélecteur en haut à gauche */}
      <AIModelSelector
        models={models}
        value={modelId}
        onChange={setModelId}
      />

      {/* sidebar / bouton toggle */}
      {sidebarVisible && (
        <Sidebar userName={userName} onToggleSidebar={toggleSidebar} />
      )}
      <button
        className="toggle-sidebar-button"
        onClick={toggleSidebar}
        style={{ position: "fixed", top: 10, left: sidebarVisible ? 270 : 10 }}
      >
        {sidebarVisible ? "«" : "»"}
      </button>

      {/* routes principales */}
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/conversation/:conversationId" element={<ChatApp />} />
        <Route path="/docs" element={<DocumentsChat />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
      </Routes>
    </div>
  );
}

/* ─── export racine avec <ModelProvider> ──────────────────────── */
export default function App() {
  return (
    <ModelProvider>
      <AppInner />
    </ModelProvider>
  );
}
