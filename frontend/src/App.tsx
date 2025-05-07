// App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatApp from './components/ChatApp';
import DocumentsChat from './components/DocumentsChat';
import ProjectPage from './components/ProjectPage';
import Sidebar from './components/Sidebar';
import AIModelSelector from './components/AIModelSelector';
import { getCurrentUser, User } from './services/userService';
import './App.css';

const models = [
  { id: "model1", name: "GPT 4o",         subtitle: "Tâches quotidiennes, rapide, usage général" },
  { id: "model2", name: "GPT 4o-mini",    subtitle: "Ultra léger, rapide, idéal pour tâches simples" },
  { id: "model3", name: "GPT o1",         subtitle: "Polyvalent, meilleur raisonnement que 4o" },
  { id: "model4", name: "GPT o1-mini",    subtitle: "Léger mais plus malin, mieux que 4o Mini" },
  { id: "model5", name: "GPT 4.1",        subtitle: "Avancé et rapide, excellent raisonnement, haut niveau." },
  { id: "model6", name: "GPT 4.1-mini",   subtitle: "Très rapide et capable, proche du grand modèle" },
  { id: "model7", name: "GPT o3-mini",    subtitle: "Modèle avancé, bonnes performances" },
  
  
];

function App() {
  const [userName, setUserName] = useState("Chargement...");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((user: User) => setUserName(user.name))
      .catch(() => setUserName("Utilisateur inconnu"));
  }, []);

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div className="App">
      <AIModelSelector models={models} />
      {sidebarVisible && <Sidebar userName={userName} onToggleSidebar={toggleSidebar} />}
      <button
        className="toggle-sidebar-button"
        onClick={toggleSidebar}
        style={{ position: "fixed", top: 10, left: sidebarVisible ? 270 : 10 }}
      >
        {sidebarVisible ? "«" : "»"}
      </button>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/conversation/:conversationId" element={<ChatApp />} />
        <Route path="/docs" element={<DocumentsChat />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
      </Routes>
    </div>
  );
}

export default App;

