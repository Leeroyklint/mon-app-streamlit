import React from "react";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";
/* écran d’accueil – pas de streaming ici */
const WelcomeScreen = ({ onSend, disabled }) => (React.createElement("div", { className: "welcome-wrapper" },
    React.createElement("div", { className: "welcome-content" },
        React.createElement("h1", { className: "welcome-title" }, "Comment puis-je vous aider\u00A0?"),
        React.createElement("div", { className: "welcome-input" },
            React.createElement(ChatInput, { onSend: onSend, onStop: () => { }, streaming: false, disabled: disabled, variant: "center" })))));
export default WelcomeScreen;
