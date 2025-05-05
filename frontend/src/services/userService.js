import { authHeaders } from "./auth";
const apiUrl = import.meta.env.VITE_API_URL;
export const getCurrentUser = async () => {
    const r = await fetch(`${apiUrl}/api/user`, {
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new Error("Erreur récupération utilisateur");
    return r.json();
};
