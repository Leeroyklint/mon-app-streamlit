import React from "react";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";

interface Props {
  onSend:   (message: string, files: File[]) => void;
  disabled?: boolean;
}

/* écran d’accueil – pas de streaming ici */
const WelcomeScreen: React.FC<Props> = ({ onSend, disabled }) => (
  <div className="welcome-wrapper">
    <div className="welcome-content">
      <h1 className="welcome-title">Comment puis-je vous aider&nbsp;?</h1>

      <div className="welcome-input">
        <ChatInput
          onSend={onSend}
          onStop={() => {}}
          streaming={false}
          disabled={disabled}
          variant="center"
        />
      </div>
    </div>
  </div>
);

export default WelcomeScreen;
