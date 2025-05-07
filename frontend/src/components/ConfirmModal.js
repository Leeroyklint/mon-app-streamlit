import React from "react";
import ReactDOM from "react-dom";
import "./ConfirmModal.css";
/**
 * Fenêtre de confirmation affichée via Portal (insertion directe dans <body>)
 * pour éviter tout souci de z-index ou de conteneur parent.
 */
const ConfirmModal = ({ open, title, message, confirmText = "Supprimer", cancelText = "Annuler", onConfirm, onCancel, }) => {
    if (!open)
        return null;
    /* -------- structure de la modale -------- */
    const modal = (React.createElement("div", { className: "confirm-back", onClick: onCancel },
        React.createElement("div", { className: "confirm-box", onClick: (e) => e.stopPropagation() },
            React.createElement("h3", null, title),
            React.createElement("div", { className: "confirm-msg" }, message),
            React.createElement("div", { className: "confirm-actions" },
                React.createElement("button", { type: "button", className: "confirm-cancel", onClick: onCancel }, cancelText),
                React.createElement("button", { type: "button", className: "confirm-delete", onClick: onConfirm }, confirmText)))));
    /* -------- Portal dans <body> -------- */
    return ReactDOM.createPortal(modal, document.body);
};
export default ConfirmModal;
