const apiUrl = import.meta.env.VITE_API_URL;
const token = "test2";
/* ---------- listes & suppression ---------- */
export const getConversations = async () => {
    const r = await fetch(`${apiUrl}/api/conversations`, {
        headers: { "X-Ms-Token-Aad-Access-Token": token },
    });
    if (!r.ok)
        throw new Error("Erreur chargement convs");
    return r.json();
};
export const deleteConversation = async (id) => {
    const r = await fetch(`${apiUrl}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { "X-Ms-Token-Aad-Access-Token": token },
    });
    if (!r.ok)
        throw new Error("Erreur suppression conv");
};
/* ----- conversations d’un projet ----- */
export const getConversationsForProject = async (projectId) => {
    const r = await fetch(`${apiUrl}/api/conversations?projectId=${projectId}`, {
        headers: { "X-Ms-Token-Aad-Access-Token": token },
    });
    if (!r.ok)
        throw new Error("Erreur convs projet");
    const groups = (await r.json());
    /* on retire ici d’éventuels “chats fantômes” (project_id manquant) */
    return Object.values(groups)
        .flat()
        .filter((c) => c.project_id); // ← garde uniquement ceux liés au projet
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
        headers: {
            "Content-Type": "application/json",
            "X-Ms-Token-Aad-Access-Token": token,
        },
        body: JSON.stringify(payload),
    });
    if (!r.ok)
        throw new Error("Erreur LLM");
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
        headers: {
            "Content-Type": "application/json",
            "X-Ms-Token-Aad-Access-Token": token,
        },
        body: JSON.stringify(payload),
    });
    if (!r.ok)
        throw new Error("Erreur création conv");
    return r.json();
};
export const getMessages = async (convId) => {
    const r = await fetch(`${apiUrl}/api/conversations/${convId}/messages`, {
        headers: { "X-Ms-Token-Aad-Access-Token": token },
    });
    if (!r.ok)
        throw new Error("Erreur messages");
    return r.json();
};
