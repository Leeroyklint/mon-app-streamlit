import React from "react";
import ReactDOM from "react-dom";
import "./ConfirmModal.css";

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Fenêtre de confirmation affichée via Portal (insertion directe dans <body>)
 * pour éviter tout souci de z-index ou de conteneur parent.
 */
const ConfirmModal: React.FC<Props> = ({
  open,
  title,
  message,
  confirmText = "Supprimer",
  cancelText = "Annuler",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  /* -------- structure de la modale -------- */
  const modal = (
    <div className="confirm-back" onClick={onCancel}>
      <div
        className="confirm-box"
        onClick={(e) => e.stopPropagation()} /* empêche la fermeture */
      >
        <h3>{title}</h3>
        <div className="confirm-msg">{message}</div>

        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="confirm-delete"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  /* -------- Portal dans <body> -------- */
  return ReactDOM.createPortal(modal, document.body);
};

export default ConfirmModal;
