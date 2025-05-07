import { Conversation } from "../interfaces/interfaces";
import { authHeaders } from "./auth";

/* --------- petite classe pour remonter le status HTTP --------- */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiUrl = import.meta.env.VITE_API_URL;

/* ---------- listes & suppression ---------- */
export const getConversations = async () => {
  const r = await fetch(`${apiUrl}/api/conversations`, { headers: authHeaders() });
  if (!r.ok) throw new ApiError(r.status, "Erreur chargement convs");
  return r.json() as Promise<Record<string, Conversation[]>>;
};

export const deleteConversation = async (id: string) => {
  const r = await fetch(`${apiUrl}/api/conversations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) throw new ApiError(r.status, "Erreur suppression conv");
};

/* ----- conversations d’un projet ----- */
export const getConversationsForProject = async (projectId: string) => {
  const r = await fetch(`${apiUrl}/api/conversations?projectId=${projectId}`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new ApiError(r.status, "Erreur convs projet");
  const groups = (await r.json()) as Record<string, Conversation[]>;
  return Object.values(groups).flat().filter((c) => c.project_id);
};

/* ---------- chat ---------- */
export const askQuestion = async (
  question: string,
  conversationId?: string,
  conversationType?: string,
  instructions?: string
) => {
  const payload: any = { question };
  if (conversationId)   payload.conversationId   = conversationId;
  if (conversationType) payload.conversationType = conversationType;
  if (instructions)     payload.instructions     = instructions;

  const r = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new ApiError(r.status, txt || "Erreur LLM");
  }
  return (await r.json()).answer as string;
};

export const createConversation = async (
  initialMsg: string,
  conversationType = "chat",
  projectId?: string,
  instructions?: string
) => {
  const payload: any = { question: initialMsg };
  if (conversationType) payload.conversationType = conversationType;
  if (projectId)        payload.projectId        = projectId;
  if (instructions)     payload.instructions     = instructions;

  const r = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new ApiError(r.status, txt || "Erreur création conv");
  }
  return r.json() as Promise<{ conversationId: string; answer: string }>;
};

export const getMessages = async (convId: string) => {
  const r = await fetch(`${apiUrl}/api/conversations/${convId}/messages`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new ApiError(r.status, "Erreur messages");
  return r.json();
};
