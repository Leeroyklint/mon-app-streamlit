// App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatApp from './components/ChatApp';
import DocumentsChat from './components/DocumentsChat';
import ProjectPage from './components/ProjectPage';
import Sidebar from './components/Sidebar';
import AIModelSelector from './components/AIModelSelector';
import { getCurrentUser } from './services/userService';
import './App.css';
const models = [
    { id: "model1", name: "GPT o1-mini" },
    { id: "model2", name: "GPT o1" },
    { id: "model3", name: "GPT 4o-mini" },
    { id: "model4", name: "GPT 4o" },
    { id: "model5", name: "GPT o3-mini" },
];
function App() {
    const [userName, setUserName] = useState("Chargement...");
    const [sidebarVisible, setSidebarVisible] = useState(true);
    useEffect(() => {
        getCurrentUser()
            .then((user) => setUserName(user.name))
            .catch(() => setUserName("Utilisateur inconnu"));
    }, []);
    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };
    return (React.createElement("div", { className: "App" },
        React.createElement(AIModelSelector, { models: models }),
        sidebarVisible && React.createElement(Sidebar, { userName: userName, onToggleSidebar: toggleSidebar }),
        React.createElement("button", { className: "toggle-sidebar-button", onClick: toggleSidebar, style: { position: "fixed", top: 10, left: sidebarVisible ? 270 : 10 } }, sidebarVisible ? "«" : "»"),
        React.createElement(Routes, null,
            React.createElement(Route, { path: "/", element: React.createElement(ChatApp, null) }),
            React.createElement(Route, { path: "/conversation/:conversationId", element: React.createElement(ChatApp, null) }),
            React.createElement(Route, { path: "/docs", element: React.createElement(DocumentsChat, null) }),
            React.createElement(Route, { path: "/projects/:projectId", element: React.createElement(ProjectPage, null) }))));
}
export default App;