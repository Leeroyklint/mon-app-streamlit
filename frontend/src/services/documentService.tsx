const apiUrl = import.meta.env.VITE_API_URL;
const token = "test2";

// Fonction modifiée pour accepter plusieurs fichiers
export const uploadDocuments = async (files: File[], conversationId?: string): Promise<any> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  if (conversationId) {
    formData.append("conversationId", conversationId);
  }
  const response = await fetch(`${apiUrl}/api/docs/upload`, {
    method: "POST",
    headers: { "X-Ms-Token-Aad-Access-Token": token },
    body: formData
  });
  if (!response.ok) throw new Error("Erreur lors de l'upload des documents.");
  return response.json();
};
