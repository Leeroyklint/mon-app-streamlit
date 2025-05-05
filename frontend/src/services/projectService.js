import { authHeaders } from "./auth";
const apiUrl = import.meta.env.VITE_API_URL;
export const createProject = async (name, instructions) => {
    const r = await fetch(`${apiUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, instructions }),
    });
    if (!r.ok)
        throw new Error("Erreur création projet");
    return r.json();
};
export const getProjects = async () => {
    const r = await fetch(`${apiUrl}/api/projects`, {
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new Error("Erreur récupération projets");
    return r.json();
};
export const deleteProject = async (projectId) => {
    const r = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new Error("Erreur suppression projet");
};
export const uploadProjectFiles = async (projectId, files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const r = await fetch(`${apiUrl}/api/projects/${projectId}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
    });
    if (!r.ok)
        throw new Error("Erreur upload fichiers projet");
    return r.json();
};
export const updateProjectInstructions = async (projectId, instructions) => {
    const r = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ instructions }),
    });
    if (!r.ok)
        throw new Error("Erreur MAJ instructions");
};
export const getProject = async (projectId) => {
    const r = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        headers: authHeaders(),
    });
    if (!r.ok)
        throw new Error("Erreur récupération projet");
    return r.json();
};
