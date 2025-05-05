import { authHeaders } from "./auth";
export const selectModel = async (modelId) => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const r = await fetch(`${apiUrl}/api/select-model`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ modelId }),
    });
    if (!r.ok)
        throw new Error("Erreur sélection modèle");
};
