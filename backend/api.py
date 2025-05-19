"""
API — Klint GPT v2
• ingestion multi-documents : résumé + RAG
• même endpoint /chat pour tous les types de conversation
• routes projets / conversations inchangées
"""

from __future__ import annotations
import logging, tiktoken, jwt
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    UploadFile,
    File,
    Form,
    Request,
)
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.db   import (
    create_conversation,
    get_conversation,
    update_conversation,
    list_conversations,
    delete_conversation,
    create_project,
    list_projects,
    delete_project,
    get_project,
    update_project,
)
from backend.model  import azure_llm_chat
from backend.models import (
    parse_pdf,
    parse_docx,
    parse_txt,
    parse_excel,
    get_text_chunks,
    build_vectorstore_from_texts,
    search_documents,
    summarize_text,                # ⬅️ résumé automatique à l’upload
)

# ─────────────────────────────────────────────────────────────────── Logger
logger = logging.getLogger("klint.api")
if not logger.handlers:           # évite doublons sous hot-reload
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )

router = APIRouter()

# ────────────────────────────────────────────────────────── Résumé thread long
ENC        = tiktoken.get_encoding("cl100k_base")
TOK_LIMIT  = 3_000        # on résume quand on dépasse ce seuil
KEEP_LAST  = 8            # on garde les 8 derniers messages « bruts »
SUM_MODEL  = "GPT o1-mini"
SUM_SYSTEM = (
    "Tu es un assistant qui résume factuellement une conversation pour conserver "
    "uniquement les informations importantes, sans rien inventer."
)

def _ntokens(txt: str) -> int:
    return len(ENC.encode(txt))

def _ensure_summary(conv: dict) -> None:
    """
    Résume tout ce qui précède KEEP_LAST messages si l’historique dépasse TOK_LIMIT.
    Stocke la synthèse dans conv['summary'] + index jusqu’où on a résumé.
    """
    msgs = conv.get("messages", [])
    done = conv.get("summary_index", 0)
    total = _ntokens(conv.get("summary", "")) + sum(_ntokens(m["content"]) for m in msgs)
    if total <= TOK_LIMIT:
        return

    cut   = max(done, len(msgs) - KEEP_LAST)
    older = msgs[done:cut]
    if not older:
        return

    to_sum = "\n\n".join(f"{m['role']}: {m['content']}" for m in older)
    summary = azure_llm_chat(
        [
            {"role": "system", "content": SUM_SYSTEM},
            {"role": "user",   "content": to_sum},
        ],
        model=SUM_MODEL,
    )
    conv["summary"]       = (conv.get("summary","") + "\n\n" + summary).strip()
    conv["summary_index"] = cut
    update_conversation(conv)

# ───────────────────────────────────────────────────────────── Prompt builder
def _build_prompt(conv: dict, question: str, base_sys: str) -> list[dict]:
    _ensure_summary(conv)

    prompt: list[dict] = []
    if base_sys:
        prompt.append({"role": "system", "content": base_sys})

    if conv.get("summary"):
        prompt.append(
            {"role": "system", "content": "Résumé de la conversation :\n" + conv["summary"]}
        )

    prompt += conv.get("messages", [])[-KEEP_LAST:]
    prompt.append({"role": "user", "content": question})
    return prompt

# ────────────────────────────────────────────────────────────  Schémas pydantic
class ChatRequest(BaseModel):
    question: str
    conversationId: Optional[str] = None
    conversationType: Optional[str] = "chat"
    projectId: Optional[str] = None
    instructions: Optional[str] = ""

class ChatResponse(BaseModel):
    answer: str
    conversationId: str

class ModelSelection(BaseModel):
    modelId: str

class ProjectRequest(BaseModel):
    name: str
    instructions: Optional[str] = ""

class ProjectUpdateRequest(BaseModel):
    instructions: Optional[str] = ""

# ─────────────────────────────────────────────────────────────── Utils
def group_conversations_by_date(convs: list[dict]) -> dict[str, list[dict]]:
    now = datetime.now(timezone.utc)
    groups = {"Aujourd’hui": [], "7 jours précédents": [], "30 jours précédents": [], "Plus anciennes": []}
    for c in convs:
        dt = datetime.fromisoformat(c["updated_at"].replace("Z","")).replace(tzinfo=timezone.utc)
        d  = (now - dt).days
        if d == 0:        groups["Aujourd’hui"].append(c)
        elif d < 7:       groups["7 jours précédents"].append(c)
        elif d < 30:      groups["30 jours précédents"].append(c)
        else:             groups["Plus anciennes"].append(c)
    return groups

# ───────────────────────────────────────────────────────── Routes ✦ user / convs
@router.get("/user")
def current_user(u: dict = Depends(get_current_user)):
    return u

@router.get("/conversations")
def get_all_conversations(
    user: dict = Depends(get_current_user),
    conversationType: Optional[str] = None,
    projectId: Optional[str] = None,
):
    convs = list_conversations(user["entra_oid"], conversationType, projectId)
    return group_conversations_by_date(convs)

@router.get("/conversations/{conv_id}/messages")
def get_conv_messages(conv_id: str, user: dict = Depends(get_current_user)):
    conv = get_conversation(user["entra_oid"], conv_id)
    if not conv:
        raise HTTPException(404, "Conversation non trouvée")
    return conv.get("messages", [])

@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conv(conv_id: str, user: dict = Depends(get_current_user)):
    delete_conversation(user["entra_oid"], conv_id)
    return

# ─────────────────────────────────────────────────────────────── Chat endpoint
@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
    uid = user["entra_oid"]
    logger.info("POST /chat by %s | cid=%s q='%s…'", uid, req.conversationId, req.question[:60])

    # ——— récupération ou création ————————————————————————————
    if req.conversationId:
        conv = get_conversation(uid, req.conversationId)
        if not conv:
            raise HTTPException(404, "Conversation non trouvée")
        conv["messages"].append({"role": "user", "content": req.question})
    else:
        conv = create_conversation(
            uid,
            req.question,
            conversation_type=req.conversationType,
            project_id=req.projectId,
        )
        if req.projectId:
            conv["instructions"] = req.instructions or ""
        update_conversation(conv)

    # ——— titre auto ————————————————————————————————
    if conv.get("title","").lower().startswith("nouveau chat"):
        conv["title"] = (req.question or "Chat").strip()[:30] or "Chat"

    # ——— contexte : instructions + docs + RAG ——————————————
    instr      = conv.get("instructions","")
    all_docs   = conv.get("documents", [])[:]               # docs attachés au chat

    # *Projets* ⇒ ajoute fichiers + instructions projet
    if conv.get("project_id"):
        proj = get_project(uid, conv["project_id"])
        if proj:
            all_docs += proj.get("files", [])
            if not instr:
                instr = proj.get("instructions","")

    # · aperçu global (résumé) de chaque doc
    doc_summaries = "\n\n".join(
        f"### {d['name']}\n{d.get('summary','')}" for d in all_docs if d.get("summary")
    )

    # · RAG ciblé : passages les plus proches de la question
    rag_context = ""
    if all_docs and req.question.strip():
        chunks = get_text_chunks("\n".join(d["content"] for d in all_docs))
        vs = build_vectorstore_from_texts(chunks)
        rag_context = "\n\n".join(search_documents(vs, req.question, k=4))

    base_sys = ""
    if instr:         base_sys += f"Project instructions:\n{instr}\n\n"
    if doc_summaries: base_sys += f"Document overviews:\n{doc_summaries}\n\n"
    if rag_context:   base_sys += f"Context passages:\n{rag_context}"

    # ——— prompt final + appel LLM ————————————————————————
    prompt = _build_prompt(conv, req.question, base_sys)
    answer = azure_llm_chat(prompt, model="GPT 4o")
    logger.debug("LLM answer len=%d chars", len(answer))

    conv["messages"].append({"role": "assistant", "content": answer})
    update_conversation(conv)
    return {"answer": answer, "conversationId": conv["id"]}

# ──────────────────────────────────────────────────────────── Sélection modèle
@router.post("/select-model")
def select_model(sel: ModelSelection, user: dict = Depends(get_current_user)):
    logger.info("Model sélectionné par %s : %s", user["entra_oid"], sel.modelId)
    return {"message": "Modèle reçu", "modelId": sel.modelId}

# ─────────────────────────────────────────────────────────── Upload documents
@router.post("/docs/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    conversationId: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    uid = user["entra_oid"]
    logger.info("Upload docs (%d fichier·s) by %s", len(files), uid)
    uploaded_docs = []

    for file in files:
        data = await file.read()
        name = file.filename
        low  = name.lower()
        if low.endswith(".pdf"):
            text = parse_pdf(data)
        elif low.endswith(".docx"):
            text = parse_docx(data)
        elif low.endswith(".txt"):
            text = parse_txt(data)
        elif low.endswith(".csv"):
            text = parse_excel(data)
        else:
            text = ""

        summary = summarize_text(text)      # ⬅️ génère l’aperçu
        uploaded_docs.append({"name": name, "content": text, "summary": summary})

    if conversationId:
        conv = get_conversation(uid, conversationId)
        if not conv:
            raise HTTPException(404, "Conversation non trouvée")
        conv["documents"] = conv.get("documents", []) + uploaded_docs
        conv["type"] = "doc"
    else:
        conv = create_conversation(uid, "", conversation_type="doc")
        conv["documents"] = uploaded_docs
        conv["messages"] = []

    conv["messages"].append(
        {
            "role": "user",
            "content": "",
            "attachments": [
                {"name": d["name"], "type": d["name"].split(".")[-1]} for d in uploaded_docs
            ],
        }
    )
    update_conversation(conv)
    logger.debug("Docs ajoutés à conv %s", conv["id"])
    return {"conversationId": conv["id"], "documents": uploaded_docs}

# ─────────────────────────────────────────────────────────────────── Projets
@router.post("/projects", status_code=201)
def create_new_project(project: ProjectRequest, user: dict = Depends(get_current_user)):
    logger.info("Création projet '%s' par %s", project.name, user["entra_oid"])
    return create_project(user["entra_oid"], project.name, project.instructions)

@router.get("/projects")
def get_projects(user: dict = Depends(get_current_user)):
    return list_projects(user["entra_oid"])

@router.get("/projects/{project_id}")
def get_single_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project(user["entra_oid"], project_id)
    if not proj:
        raise HTTPException(404, "Projet non trouvé")
    return proj

@router.put("/projects/{project_id}")
def update_single_project(
    project_id: str,
    body: ProjectUpdateRequest,
    user: dict = Depends(get_current_user),
):
    proj = get_project(user["entra_oid"], project_id)
    if not proj:
        raise HTTPException(404, "Projet non trouvé")
    proj["instructions"] = body.instructions or ""
    update_project(proj)
    logger.info("MAJ instructions projet %s", project_id)
    return proj

@router.delete("/projects/{project_id}", status_code=204)
def delete_proj(project_id: str, user: dict = Depends(get_current_user)):
    delete_project(user["entra_oid"], project_id)
    return

@router.post("/projects/{project_id}/upload")
async def upload_project_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    proj = get_project(user["entra_oid"], project_id)
    if not proj:
        raise HTTPException(404, "Projet non trouvé")

    proj_files = proj.get("files", [])
    for f in files:
        data = await f.read()
        name = f.filename
        low  = name.lower()
        if low.endswith(".pdf"):
            text = parse_pdf(data)
        elif low.endswith(".docx"):
            text = parse_docx(data)
        elif low.endswith(".txt"):
            text = parse_txt(data)
        elif low.endswith(".csv"):
            text = parse_excel(data)
        else:
            text = ""
        summary = summarize_text(text)
        proj_files.append({"name": name, "content": text, "summary": summary})

    proj["files"] = proj_files
    update_project(proj)
    logger.debug("Ajout de %d fichiers au projet %s", len(files), project_id)
    return {"projectId": project_id, "files": proj_files}
