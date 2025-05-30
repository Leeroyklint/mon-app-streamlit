import { authHeaders } from "./auth";
const apiUrl = import.meta.env.VITE_API_URL;
/* -------- OCR GPT-4o -------- */
export const ocrImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${apiUrl}/api/images/ocr`, {
        method: "POST", headers: authHeaders(), body: fd
    });
    if (!r.ok)
        throw new Error("OCR failed");
    return (await r.json()).text;
};
/* -------- Génération DALL·E-3 -------- */
export const generateImage = async (prompt, conversationId, size = "1024x1024") => {
    const r = await fetch(`${apiUrl}/api/images/generate`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt, size, conversationId }),
    });
    if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        /* on relance l’erreur lisible par ChatApp */
        throw new Error(data?.detail || `Generation failed (HTTP ${r.status})`);
    }
    return r.json(); // ← contient { url, conversationId }
};
