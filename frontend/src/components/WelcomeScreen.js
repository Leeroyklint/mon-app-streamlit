import React from "react";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";
/**
 * Écran d’accueil (titre + champ centré)
 * – le wrapper entier n’intercepte pas les clics (pointer-events:none)
 *   ⇒ la sidebar reste interactive.
 */
const WelcomeScreen = ({ onSend, disabled }) => (React.createElement("div", { className: "welcome-wrapper" },
    React.createElement("div", { className: "welcome-content" },
        React.createElement("h1", { className: "welcome-title" }, "Comment puis-je vous aider\u00A0?"),
        React.createElement("div", { className: "welcome-input" },
            React.createElement(ChatInput, { onSend: onSend, disabled: disabled, variant: "center" })))));
export default WelcomeScreen;
