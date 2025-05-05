const apiUrl = import.meta.env.VITE_API_URL;
const token = "test2";
export const createProject = async (name, instructions) => {
    const response = await fetch(`${apiUrl}/api/projects`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Ms-Token-Aad-Access-Token": token
        },
        body: JSON.stringify({ name, instructions })
    });
    if (!response.ok)
        throw new Error("Erreur lors de la création du projet.");
    return response.json();
};
export const getProjects = async () => {
    const response = await fetch(`${apiUrl}/api/projects`, {
        headers: { "X-Ms-Token-Aad-Access-Token": token }
    });
    if (!response.ok)
        throw new Error("Erreur lors de la récupération des projets.");
    return response.json();
};
export const deleteProject = async (projectId) => {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { "X-Ms-Token-Aad-Access-Token": token }
    });
    if (!response.ok)
        throw new Error("Erreur lors de la suppression du projet.");
};
export const uploadProjectFiles = async (projectId, files) => {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append("files", file);
    });
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/upload`, {
        method: "POST",
        headers: { "X-Ms-Token-Aad-Access-Token": token },
        body: formData
    });
    if (!response.ok)
        throw new Error("Erreur lors de l'upload des fichiers pour le projet.");
    return response.json();
};
export const updateProjectInstructions = async (projectId, instructions) => {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "X-Ms-Token-Aad-Access-Token": token
        },
        body: JSON.stringify({ instructions })
    });
    if (!response.ok)
        throw new Error("Erreur lors de la mise à jour des instructions.");
};
export const getProject = async (projectId) => {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        headers: { "X-Ms-Token-Aad-Access-Token": token }
    });
    if (!response.ok)
        throw new Error("Erreur lors de la récupération du projet.");
    return response.json();
};
