export const selectModel = async (modelId) => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const response = await fetch(`${apiUrl}/api/select-model`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Ms-Token-Aad-Access-Token": "test2"
        },
        body: JSON.stringify({ modelId }),
    });
    if (!response.ok)
        throw new Error("Erreur lors de la communication avec le serveur");
};
