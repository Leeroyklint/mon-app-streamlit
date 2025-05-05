"""
API — Klint GPT
• plus de message automatique à l’upload
• PUT /projects/{id} pour éditer les instructions
"""

from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Depends,
    UploadFile,
    File,
    Form,
)
import jwt
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from backend.db import (
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
from backend.model import azure_llm_chat
from backend.models import (
    parse_pdf,
    parse_docx,
    parse_txt,
    parse_excel,
    get_text_chunks,
    build_vectorstore_from_texts,
    search_documents,
)

from backend.auth import get_current_user

router = APIRouter()

# ------------------------------------------------------------------
#  Auth helper
# ------------------------------------------------------------------
def get_current_user(request: Request):
    """
    Renvoie un dict (claims du JWT) ou lève 401.
    Le jeton de dev « test2 » renvoie un utilisateur fictif.
    """
    tok = request.headers.get("X-Ms-Token-Aad-Access-Token")
    if not tok:
        raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
    try:
        if tok == "test2":                              # jeton local dev
            return {"entra_oid": "user-123", "name": "TestUser"}
        return jwt.decode(tok, algorithms=["RS256"], options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalide : {e}")


# ------------------------------------------------------------------
#  Schémas
# ------------------------------------------------------------------
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


# ------------------------------------------------------------------
#  Utils
# ------------------------------------------------------------------
def group_conversations_by_date(convs):
    now = datetime.now(timezone.utc)
    groups = {
        "Aujourd’hui": [],
        "7 jours précédents": [],
        "30 jours précédents": [],
        "Plus anciennes": [],
    }
    for c in convs:
        dt = datetime.fromisoformat(c["updated_at"].replace("Z", "")).replace(
            tzinfo=timezone.utc
        )
        d = (now - dt).days
        if d == 0:
            groups["Aujourd’hui"].append(c)
        elif d < 7:
            groups["7 jours précédents"].append(c)
        elif d < 30:
            groups["30 jours précédents"].append(c)
        else:
            groups["Plus anciennes"].append(c)
    return groups


# ------------------------------------------------------------------
#  Routes — user / conversations
# ------------------------------------------------------------------
@router.get("/user")
def current_user(user: dict = Depends(get_current_user)):
    """Renvoie {entra_oid, name} pour le front."""
    return user


@router.get("/conversations")
def get_all_conversations(
    user: dict = Depends(get_current_user),
    conversationType: Optional[str] = None,
    projectId: Optional[str] = None,
):
    convs = list_conversations(
        user["entra_oid"], conversation_type=conversationType, project_id=projectId
    )
    return group_conversations_by_date(convs)


@router.get("/conversations/{conv_id}/messages")
def get_conv_messages(conv_id: str, user: dict = Depends(get_current_user)):
    conv = get_conversation(user["entra_oid"], conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")
    return conv.get("messages", [])


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conv(conv_id: str, user: dict = Depends(get_current_user)):
    delete_conversation(user["entra_oid"], conv_id)
    return


# ------------------------------------------------------------------
#  Chat endpoint
# ------------------------------------------------------------------
@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
    entra_oid = user["entra_oid"]
    selected_model = "GPT o1-mini"

    # ---------- récupération ou création ----------
    if req.conversationId:
        conv = get_conversation(entra_oid, req.conversationId)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        conv["messages"].append({"role": "user", "content": req.question})
    else:
        conv = create_conversation(
            entra_oid,
            req.question,
            conversation_type=req.conversationType,
            project_id=req.projectId,
        )
        if req.projectId:
            conv["instructions"] = req.instructions or ""
        update_conversation(conv)

    # ---------- titre auto ----------
    if conv.get("title", "").lower().startswith("nouveau chat"):
        conv["title"] = (req.question or "Chat").strip()[:30] or "Chat"

    conv_type = conv.get("type") or req.conversationType or "chat"

    # ---------- contexte ----------
    context = ""
    instr = conv.get("instructions", "")
    proj_files: list = []
    if conv_type == "project" or conv.get("project_id"):
        proj = get_project(entra_oid, conv.get("project_id"))
        if proj:
            proj_files = proj.get("files", [])
            if not instr:
                instr = proj.get("instructions", "")

    if conv_type == "doc":
        docs = conv.get("documents", [])
        if docs:
            chunks = get_text_chunks("\n".join(d["content"] for d in docs))
            vs = build_vectorstore_from_texts(chunks)
            context = "\n\n".join(search_documents(vs, req.question, k=4))
    elif conv_type == "project":
        all_files = conv.get("files", []) + proj_files
        if all_files:
            chunks = get_text_chunks("\n".join(f["content"] for f in all_files))
            vs = build_vectorstore_from_texts(chunks)
            context = "\n\n".join(search_documents(vs, req.question, k=4))

    sys_msg = ""
    if instr:
        sys_msg += f"Project instructions:\n{instr}\n\n"
    if context:
        sys_msg += f"Context:\n{context}"

    messages = conv.get("messages", [])
    if sys_msg:
        messages = [{"role": "system", "content": sys_msg}] + messages

    answer = azure_llm_chat(messages, model=selected_model)

    conv["messages"].append({"role": "assistant", "content": answer})
    update_conversation(conv)
    return {"answer": answer, "conversationId": conv["id"]}


@router.post("/select-model")
def select_model(sel: ModelSelection, user: dict = Depends(get_current_user)):
    return {"message": "Modèle reçu", "modelId": sel.modelId}


# ------------------------------------------------------------------
#  Upload de documents
# ------------------------------------------------------------------
@router.post("/docs/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    conversationId: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    entra_oid = user["entra_oid"]
    uploaded_docs = []

    for file in files:
        data = await file.read()
        name = file.filename.lower()
        if name.endswith(".pdf"):
            text = parse_pdf(data)
        elif name.endswith(".docx"):
            text = parse_docx(data)
        elif name.endswith(".txt"):
            text = parse_txt(data)
        elif name.endswith(".csv"):
            text = parse_excel(data)
        else:
            text = ""
        uploaded_docs.append({"name": file.filename, "content": text})

    if conversationId:
        conv = get_conversation(entra_oid, conversationId)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        conv["documents"] = conv.get("documents", []) + uploaded_docs
        conv["type"] = "doc"
    else:
        conv = create_conversation(entra_oid, "", conversation_type="doc")
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
    return {"conversationId": conv["id"], "documents": uploaded_docs}


# ------------------------------------------------------------------
#  Projets
# ------------------------------------------------------------------
@router.post("/projects", status_code=201)
def create_new_project(project: ProjectRequest, user: dict = Depends(get_current_user)):
    return create_project(user["entra_oid"], project.name, project.instructions)


@router.get("/projects")
def get_projects(user: dict = Depends(get_current_user)):
    return list_projects(user["entra_oid"])


@router.get("/projects/{project_id}")
def get_single_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project(user["entra_oid"], project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    return proj


@router.put("/projects/{project_id}")
def update_single_project(
    project_id: str,
    body: ProjectUpdateRequest,
    user: dict = Depends(get_current_user),
):
    proj = get_project(user["entra_oid"], project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    proj["instructions"] = body.instructions or ""
    update_project(proj)
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
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    proj_files = proj.get("files", [])
    for f in files:
        data = await f.read()
        name = f.filename.lower()
        if name.endswith(".pdf"):
            text = parse_pdf(data)
        elif name.endswith(".docx"):
            text = parse_docx(data)
        elif name.endswith(".txt"):
            text = parse_txt(data)
        elif name.endswith(".csv"):
            text = parse_excel(data)
        else:
            text = ""
        proj_files.append({"name": f.filename, "content": text})

    proj["files"] = proj_files
    update_project(proj)
    return {"projectId": project_id, "files": proj_files}
