import React from "react";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";

interface Props {
  onSend:   (message: string, files: File[]) => void;
  disabled?: boolean;
}

/**
 * Écran d’accueil (titre + champ centré)
 * – le wrapper entier n’intercepte pas les clics (pointer-events:none)
 *   ⇒ la sidebar reste interactive.
 */
const WelcomeScreen: React.FC<Props> = ({ onSend, disabled }) => (
  <div className="welcome-wrapper">
    <div className="welcome-content">
      <h1 className="welcome-title">Comment puis-je vous aider&nbsp;?</h1>

      <div className="welcome-input">
        <ChatInput onSend={onSend} disabled={disabled} variant="center" />
      </div>
    </div>
  </div>
);

export default WelcomeScreen;
