import { authHeaders } from "./auth";
/* --------- petite classe pour remonter le status HTTP --------- */
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
const apiUrl = import.meta.env.VITE_API_URL;
/* ---------- listes & suppression ---------- */
export const getConversations = async () => {
    const r = await fetch(`${apiUrl}/api/conversations`, { headers: authHeaders() });
    if (!r.ok)
        throw new ApiError(r.status, "Erreur chargement convs");
    return r.json();
};
export const deleteConversation = async (id) => {
    const r = await fetch(`${apiUrl}/api/conversations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new ApiError(r.status, "Erreur suppression conv");
};
/* ----- conversations d’un projet ----- */
export const getConversationsForProject = async (projectId) => {
    const r = await fetch(`${apiUrl}/api/conversations?projectId=${projectId}`, {
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new ApiError(r.status, "Erreur convs projet");
    const groups = (await r.json());
    return Object.values(groups).flat().filter((c) => c.project_id);
};
/* ---------- chat ---------- */
export const askQuestion = async (question, conversationId, conversationType, instructions) => {
    const payload = { question };
    if (conversationId)
        payload.conversationId = conversationId;
    if (conversationType)
        payload.conversationType = conversationType;
    if (instructions)
        payload.instructions = instructions;
    const r = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new ApiError(r.status, txt || "Erreur LLM");
    }
    return (await r.json()).answer;
};
export const createConversation = async (initialMsg, conversationType = "chat", projectId, instructions) => {
    const payload = { question: initialMsg };
    if (conversationType)
        payload.conversationType = conversationType;
    if (projectId)
        payload.projectId = projectId;
    if (instructions)
        payload.instructions = instructions;
    const r = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new ApiError(r.status, txt || "Erreur création conv");
    }
    return r.json();
};
export const getMessages = async (convId) => {
    const r = await fetch(`${apiUrl}/api/conversations/${convId}/messages`, {
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new ApiError(r.status, "Erreur messages");
    return r.json();
};
