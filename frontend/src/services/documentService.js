import { authHeaders } from "./auth";
const apiUrl = import.meta.env.VITE_API_URL;
export const uploadDocuments = async (files, conversationId) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (conversationId)
        formData.append("conversationId", conversationId);
    const r = await fetch(`${apiUrl}/api/docs/upload`, {
        method: "POST",
        headers: authHeaders(), // FormData → pas de Content‑Type manuel
        body: formData,
    });
    if (!r.ok)
        throw new Error("Erreur upload documents");
    return r.json();
};
/* ---------------------- création de document ---------------------- */
export const createDocument = async (type, content) => {
    const r = await fetch(`${apiUrl}/api/docs/create`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type, content }),
    });
    if (!r.ok)
        throw new Error(`Erreur création ${type}`);
    return r; // on renvoie la Response (blob)
};
