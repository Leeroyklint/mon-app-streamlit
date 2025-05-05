import { authHeaders } from "./auth";

export interface User {
  entra_oid: string;
  name: string;
}

const apiUrl = import.meta.env.VITE_API_URL;

export const getCurrentUser = async (): Promise<User> => {
  const r = await fetch(`${apiUrl}/api/user`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error("Erreur récupération utilisateur");
  return r.json();
};
