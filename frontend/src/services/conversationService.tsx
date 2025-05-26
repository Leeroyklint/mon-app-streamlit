import { Conversation } from "../interfaces/interfaces";
import { authHeaders } from "./auth";

/* --------  Gestion d’erreurs HTTP -------- */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiUrl = import.meta.env.VITE_API_URL;

/* ============================================================= */
/*  LISTES / CRUD                                                 */
/* ============================================================= */
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

export const getConversationsForProject = async (projectId: string) => {
  const r = await fetch(`${apiUrl}/api/conversations?projectId=${projectId}`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new ApiError(r.status, "Erreur convs projet");
  const groups = (await r.json()) as Record<string, Conversation[]>;
  return Object.values(groups).flat().filter((c) => c.project_id);
};

export const getMessages = async (convId: string) => {
  const r = await fetch(`${apiUrl}/api/conversations/${convId}/messages`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new ApiError(r.status, "Erreur messages");
  return r.json();
};

/* ============================================================= */
/*  CRÉATION DE CONVERSATION (POST /chat)                         */
/* ============================================================= */
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

/* ============================================================= */
/*  RÉPONSE COMPLÈTE (legacy)                                     */
/* ============================================================= */
export const askQuestion = async (
  question: string,
  conversationId?: string,
  conversationType = "chat",
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

/* ============================================================= */
/*  STREAMING (POST /chat/stream)                                */
/* ============================================================= */
export interface StreamCallbacks {
  onDelta:  (chunk: string) => void;
  onDone:   () => void;
  onError:  (err: any) => void;
  onConvId?: (id: string) => void;
}

export function askQuestionStream(
  {
    question,
    conversationId,
    conversationType = "chat",
    instructions,
    modelId,  
  }: {
    question: string;
    conversationId?: string;
    conversationType?: string;
    instructions?: string;
    modelId?: string;
  },
  { onDelta, onDone, onError, onConvId }: StreamCallbacks
): { cancel: () => void } {
  const ctrl = new AbortController();

  const payload: any = { question };
  if (conversationId)   payload.conversationId   = conversationId;
  if (conversationType) payload.conversationType = conversationType;
  if (instructions)     payload.instructions     = instructions;
  if (modelId)          payload.modelId          = modelId;

  fetch(`${apiUrl}/api/chat/stream`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: ctrl.signal,
  })
    .then(async (r) => {
      if (!r.ok) throw new ApiError(r.status, await r.text());

      /* === NOUVEAU : modèle & déploiement utilisés === */
      const model      = r.headers.get("x-llm-model");
      const deployment = r.headers.get("x-llm-deployment");
      if (model) {
        console.info("Réponse servie par :", model, "→", deployment);
        /* Tu peux stocker ces infos dans un state global ou context si besoin */
      }

      /* --- conversation ID reçu dès le 1er token --- */
      const newId = r.headers.get("x-conversation-id") || undefined;
      if (newId && onConvId) onConvId(newId);

      const reader  = r.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        onDelta(decoder.decode(value));
      }
      onDone();
    })
    .catch(onError);

  return { cancel: () => ctrl.abort() };
}

/* Helper simplifié pour autres écrans */
export const askQuestionAsStream = (
  question: string,
  conversationId: string | undefined,
  conversationType: string,
  instructions: string | undefined,
  cb: StreamCallbacks,
) => askQuestionStream({ question, conversationId, conversationType, instructions }, cb);
