const apiUrl = import.meta.env.VITE_API_URL;
export const getCurrentUser = async () => {
    const response = await fetch(`${apiUrl}/api/user`, {
        method: "GET",
        headers: { "X-Ms-Token-Aad-Access-Token": "test2" }
    });
    if (!response.ok)
        throw new Error("Erreur lors de la récupération des informations utilisateur");
    return response.json();
};
