"""
API — Klint GPT v3
• ingestion multi-documents : résumé + RAG
• /api/chat           ➜ réponse complète
• /api/chat/stream    ➜ réponse token-par-token (header x-conversation-id)
• /api/images/ocr     ➜ OCR GPT-4o
• /api/images/generate ➜ DALL·E-3
"""

from __future__ import annotations

import base64, logging, tiktoken, mimetypes
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Iterable

from fastapi import (
    APIRouter, HTTPException, Depends, UploadFile,
    File, Form, Request
)
from fastapi.responses import StreamingResponse, JSONResponse

from backend.auth  import get_current_user
from backend.db    import (
    create_conversation, get_conversation, update_conversation,
    list_conversations, delete_conversation,
    create_project,     list_projects,     delete_project,
    get_project,        update_project,
)
from backend.model import (
    azure_llm_chat, azure_llm_chat_stream,
    gpt4o_ocr, dalle3_generate,
)
from backend.model import RAW_MODELS, _requires_vision
from backend.models import (
    parse_pdf, parse_docx, parse_txt, parse_excel,
    get_text_chunks, build_vectorstore_from_texts,
    search_documents, summarize_text,
)

# ───────────────────────────── Logger
logger = logging.getLogger("klint.api")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )

router = APIRouter()

# ───────────────────────────── Résumé long thread
ENC, TOK_LIMIT, KEEP_LAST = (
    tiktoken.get_encoding("cl100k_base"),
    1500,
    30,
)
SUM_MODEL  = "GPT o1-mini"
SUM_SYSTEM = (
    "Tu résumes factuellement la conversation ci-dessous.\n"
    "1. S'il y a de nouvelles INFORMATIONS PERSONNELLES STABLES sur l'utilisateur "
    "(nom, âge, ville, métier, passions), ajoute-les en puces « • ».\n"
    "2. S'il y a des blocs de code importants, ajoute-les également en puces « • ».\n"
    "3. Résume ensuite le reste en 2–3 phrases max.\n"
    "N'invente rien."
)

def _ntokens(txt: str) -> int:
    return len(ENC.encode(txt))

def _ensure_summary(conv: dict) -> None:
    msgs = conv.get("messages", [])
    done = conv.get("summary_index", 0)
    total = _ntokens(conv.get("summary", "")) + sum(_ntokens(m["content"]) for m in msgs)
    if total <= TOK_LIMIT:
        return

    cut   = max(done, len(msgs) - KEEP_LAST)
    older = msgs[done:cut]
    if not older:
        return

    to_sum  = "\n\n".join(f"{m['role']}: {m['content']}" for m in older)
    summary = azure_llm_chat(
        [
            {"role": "system", "content": SUM_SYSTEM},
            {"role": "user",   "content": to_sum},
        ],
        model=SUM_MODEL,
    )[0]
    conv["summary"]       = (conv.get("summary", "") + "\n\n" + summary).strip()
    conv["summary_index"] = cut
    update_conversation(conv)

# ───────────────────────────── Prompt builder & helper
def _build_prompt(
    conv: dict,
    question: str,
    base_sys: str,
    model_name: str | None = None,        
) -> list[dict]:
    """
    Construit la liste complète « messages » à envoyer au LLM.

    - base_sys      : contexte système commun (instructions projet, RAG, etc.)
    - model_name    : si présent, ajoute une consigne précisant le modèle à annoncer
    """
    _ensure_summary(conv)

    prompt: list[dict] = []

    # ─── 1. contexte  ─────────────────────────────────────────────
    if base_sys:
        prompt.append({"role": "system", "content": base_sys.strip()})

    prompt.insert(0,{
        "role":"system",
        "content":"Si ta réponse contient du code, encadre-le **obligatoirement** avec ```lang … ```."
    })

    # ─── 2. (optionnel) indiquer explicitement le modèle choisi ──
    if model_name:
        prompt.append({
            "role": "system",
            "content": (
                f"Tu es le modèle **{model_name}**. "
                "Si l’utilisateur demande quel modèle tu es, "
                "réponds ce nom, et surtout de ne pas oublier de dire que tu es un assistant virtuel à la disposition de ses utilisateurs."
            )
        })

    # ─── 3. résumé de la conversation ────────────────────────────
    if conv.get("summary"):
        prompt.append({
            "role": "system",
            "content": "Résumé de la conversation :\n" + conv["summary"]
        })

    # ─── 4. historique + nouvelle question ───────────────────────
    prompt += conv.get("messages", [])[-KEEP_LAST:]
    prompt.append({"role": "user", "content": question})

    return prompt

IMG_EXT = {"jpg","jpeg","png","gif","webp","bmp","svg"}

def _prepare_conversation(req, uid: str) -> Tuple[dict, Iterable[dict]]:
    """
    Charge ou crée la conversation, ajoute le prompt utilisateur,
    construit le tableau complet « messages » à envoyer au LLM.
    """
    # ── 1. modèle demandé (défaut GPT 4o) ───────────────────────────────
    chosen_model = req.modelId or "GPT 4o"

    # ───── récup / création ─────────────────────────────────────────
    if req.conversationId:
        conv = get_conversation(uid, req.conversationId)
        if not conv:
            raise HTTPException(404, "Conversation non trouvée")

        msg = {"role": "user", "content": req.question}

        # pièces jointes héritées
        if conv.get("documents") and not any(m.get("attachments") for m in conv["messages"]):
            msg["attachments"] = [
                {
                    "name": d["name"],
                    "type": d.get("type") or d["name"].split(".")[-1],
                    "url":  d.get("url", ""),
                }
                for d in conv["documents"]
            ]

        conv["messages"].append(msg)
        update_conversation(conv)

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

    # ───── titre auto ───────────────────────────────────────────────
    if conv.get("title","").lower().startswith("nouveau chat") and req.question.strip():
        conv["title"] = req.question.strip()[:30]
        update_conversation(conv)

    # ───── contexte (instr + docs + RAG) ────────────────────────────
    instr, all_docs = conv.get("instructions",""), conv.get("documents",[])[:]

    if conv.get("project_id"):
        proj = get_project(uid, conv["project_id"])
        if proj:
            all_docs += proj.get("files",[])
            if not instr:
                instr = proj.get("instructions","")

    doc_summaries = "\n\n".join(
        f"### {d['name']}\n{d.get('summary','')}" for d in all_docs if d.get("summary")
    )

    rag_context = ""
    if all_docs and req.question.strip():
        chunks = get_text_chunks("\n".join(d["content"] for d in all_docs))
        vs     = build_vectorstore_from_texts(chunks)
        rag_context = "\n\n".join(search_documents(vs, req.question, k=4))

    base_sys = ""
    if instr:         base_sys += f"Project instructions:\n{instr}\n\n"
    if doc_summaries: base_sys += f"Document overviews:\n{doc_summaries}\n\n"
    if rag_context:   base_sys += f"Context passages:\n{rag_context}"

    prompt = _build_prompt(conv, req.question, base_sys, model_name=chosen_model)

    # ── 4. Vision : convertit les attachments ----------------------------------
    last_msg = conv["messages"][-1]
    img_atts = [
        a for a in last_msg.get("attachments", [])
        if (a.get("type","").startswith("image")
            or a["name"].split(".")[-1].lower() in IMG_EXT)
        and a.get("url")
    ]
    if img_atts:
        prompt[-1]["content"] = (
            [{"type": "text", "text": req.question}] +
            [{"type": "image_url", "image_url": {"url": a["url"]}} for a in img_atts]
        )

    # ── 5. 2-passes : si images + modèle ≠ 4o → GPT-4o d’abord ------------------
    if _requires_vision(prompt) and chosen_model != "GPT 4o":
        vision_txt, _ = azure_llm_chat(prompt, model="GPT 4o")
        prompt[-1]["content"] = vision_txt  

    return conv, prompt, chosen_model

# ───────────────────────────── Schemas
from pydantic import BaseModel

class ChatRequest(BaseModel):
    question: str
    conversationId: Optional[str] = None
    conversationType: Optional[str] = "chat"
    projectId: Optional[str] = None
    instructions: Optional[str] = ""
    modelId: Optional[str] = None

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

class ImageRequest(BaseModel):
    prompt: str
    size:   str | None = "1024x1024"

# ───────────────────────────── Utilitaires dates → groupes
def _group_by_date(convs: list[dict]) -> dict[str, list[dict]]:
    now = datetime.now(timezone.utc)
    groups = {"Aujourd’hui": [], "7 jours précédents": [], "30 jours précédents": [], "Plus anciennes": []}
    for c in convs:
        dt = datetime.fromisoformat(c["updated_at"].replace("Z","")).replace(tzinfo=timezone.utc)
        diff = (now - dt).days
        if   diff == 0: groups["Aujourd’hui"].append(c)
        elif diff < 7:  groups["7 jours précédents"].append(c)
        elif diff < 30: groups["30 jours précédents"].append(c)
        else:           groups["Plus anciennes"].append(c)
    return groups

# ───────────────────────────── Routes user / conversations
@router.get("/user")
def current_user(u: dict = Depends(get_current_user)): return u

@router.get("/conversations")
def get_all_conversations(
    user: dict = Depends(get_current_user),
    conversationType: Optional[str] = None,
    projectId: Optional[str] = None,
):
    convs = list_conversations(user["entra_oid"], conversationType, projectId)
    return _group_by_date(convs)

@router.get("/conversations/{conv_id}/messages")
def get_conv_messages(conv_id: str, user: dict = Depends(get_current_user)):
    conv = get_conversation(user["entra_oid"], conv_id)
    if not conv: raise HTTPException(404, "Conversation non trouvée")
    return conv.get("messages", [])

@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conv(conv_id: str, user: dict = Depends(get_current_user)):
    delete_conversation(user["entra_oid"], conv_id); return

# ───────────────────────────── OCR  (GPT-4o vision)
@router.post("/images/ocr")
async def ocr_image(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    content = await file.read()
    text = gpt4o_ocr(content, file.content_type or "image/png")
    return {"text": text}

# ───────────────────────────── Génération image (DALL·E-3)
@router.post("/images/generate")
async def dalle_generate(req: Request, user: dict = Depends(get_current_user)):
    data        = await req.json()
    prompt      = data.get("prompt", "")
    size        = data.get("size",  "1024x1024")
    conv_id_in  = data.get("conversationId")        # ← peut être None

    url = dalle3_generate(prompt, size=size)

    # ── persistance ───────────────────────────────────────────────
    def _save_to_conv(conv: dict) -> None:
        # ① message user
        if prompt.strip():
            conv["messages"].append({"role": "user", "content": prompt})
        # ② réponse du bot = pièce jointe image
        conv["messages"].append({
            "role": "assistant",
            "content": "",                     
            "attachments": [{
                "name": "image.png",
                "type": "image/png",
                "url":  url,
            }],
        })
        update_conversation(conv)

    # conversation existante fournie
    if conv_id_in:
        conv = get_conversation(user["entra_oid"], conv_id_in)
        if conv: _save_to_conv(conv)
        conv_id_out = conv_id_in
    # sinon on crée un nouveau chat « image »
    else:
        conv = create_conversation(user["entra_oid"], prompt, conversation_type="chat")
        _save_to_conv(conv)
        conv_id_out = conv["id"]

    return {"url": url, "conversationId": conv_id_out}


# ───────────────────────────── /chat  (réponse complète)
@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
    uid = user["entra_oid"]
    conv, prompt, chosen = _prepare_conversation(req, uid)

    answer, llm_headers   = azure_llm_chat(prompt, model=chosen)

    conv["messages"].append({"role": "assistant", "content": answer})
    update_conversation(conv)

    headers = {"x-conversation-id": conv["id"], **llm_headers}
    return JSONResponse({"answer": answer, "conversationId": conv["id"]}, headers=headers)

# ───────────────────────────── /chat/stream
@router.post("/chat/stream")
def chat_stream(req: ChatRequest, user: dict = Depends(get_current_user)):
    uid = user["entra_oid"]
    conv, prompt, chosen = _prepare_conversation(req, uid)

    gen, llm_headers = azure_llm_chat_stream(prompt, model=chosen)

    def wrapper():
        buffer = ""
        try:
            for delta in gen:
                buffer += delta
                yield delta
            conv["messages"].append({"role": "assistant", "content": buffer})
            update_conversation(conv)
        except Exception as exc:
            logger.exception("stream error")
            yield f"\n[ERREUR] {exc}\n"

    return StreamingResponse(
        wrapper(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "x-conversation-id": conv["id"],
            **llm_headers,
        },
    )

# ───────────────────────────── modèle sélectionné
@router.post("/select-model")
def select_model(sel: ModelSelection, user: dict = Depends(get_current_user)):
    logger.info("Model sélectionné par %s : %s", user["entra_oid"], sel.modelId)
    return {"message": "Modèle reçu", "modelId": sel.modelId}

# ───────────────────────────── Upload de documents (texte + images)
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
        ctype= file.content_type or mimetypes.guess_type(name)[0] or ""
        low  = name.lower()

        if ctype.startswith("image/"):
            b64 = base64.b64encode(data).decode()
            url = f"data:{ctype};base64,{b64}"
            uploaded_docs.append({"name": name, "content": "", "summary": "",
                                  "type": ctype, "url": url})
            continue

        if   low.endswith(".pdf"):  text = parse_pdf(data)
        elif low.endswith(".docx"): text = parse_docx(data)
        elif low.endswith(".txt"):  text = parse_txt(data)
        elif low.endswith(".csv"):  text = parse_excel(data)
        else:                       text = ""

        summary = summarize_text(text)
        uploaded_docs.append({"name": name, "content": text, "summary": summary})

    if conversationId:
        conv = get_conversation(uid, conversationId)
        if not conv: raise HTTPException(404, "Conversation non trouvée")
        conv["documents"] = conv.get("documents", []) + uploaded_docs
        conv.setdefault("type", "doc")
    else:
        conv = create_conversation(uid, "", conversation_type="doc")
        conv["documents"] = uploaded_docs
        conv["messages"]  = []

    update_conversation(conv)
    logger.debug("Docs ajoutés à conv %s", conv["id"])
    return {"conversationId": conv["id"], "documents": uploaded_docs}

# ─────────────────────────────────────────────────────────────── Projets
@router.post("/projects", status_code=201)
def create_new_project(project: ProjectRequest, user: dict = Depends(get_current_user)):
    logger.info("Création projet '%s' par %s", project.name, user["entra_oid"])
    return create_project(user["entra_oid"], project.name, project.instructions)

@router.get("/projects")
def get_projects(user: dict = Depends(get_current_user)): return list_projects(user["entra_oid"])

@router.get("/projects/{project_id}")
def get_single_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project(user["entra_oid"], project_id)
    if not proj: raise HTTPException(404, "Projet non trouvé")
    return proj

@router.put("/projects/{project_id}")
def update_single_project(
    project_id: str,
    body: ProjectUpdateRequest,
    user: dict = Depends(get_current_user),
):
    proj = get_project(user["entra_oid"], project_id)
    if not proj: raise HTTPException(404, "Projet non trouvé")
    proj["instructions"] = body.instructions or ""
    update_project(proj)
    logger.info("MAJ instructions projet %s", project_id)
    return proj

@router.delete("/projects/{project_id}", status_code=204)
def delete_proj(project_id: str, user: dict = Depends(get_current_user)):
    delete_project(user["entra_oid"], project_id); return

@router.post("/projects/{project_id}/upload")
async def upload_project_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    proj = get_project(user["entra_oid"], project_id)
    if not proj: raise HTTPException(404, "Projet non trouvé")

    proj_files = proj.get("files", [])
    for f in files:
        data = await f.read()
        name = f.filename
        low  = name.lower()
        if   low.endswith(".pdf"):  text = parse_pdf(data)
        elif low.endswith(".docx"): text = parse_docx(data)
        elif low.endswith(".txt"):  text = parse_txt(data)
        elif low.endswith(".csv"):  text = parse_excel(data)
        else:                       text = ""
        summary = summarize_text(text)
        proj_files.append({"name": name, "content": text, "summary": summary})

    proj["files"] = proj_files
    update_project(proj)
    logger.debug("Ajout de %d fichiers au projet %s", len(files), project_id)
    return {"projectId": project_id, "files": proj_files}

@router.get("/quota")
def get_quota():
    return {m: {"rpm": cfg["rpm"], "tpm": cfg["tpm"]}
            for m, cfg in RAW_MODELS.items()}