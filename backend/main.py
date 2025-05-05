"""
Point d’entrée FastAPI – sert l’API **et** les fichiers statiques React
(cf. build_front.sh pour la copie de la build).

• liste « origins » fixée dans le code → plus de variables d’environnement
• Route catch‑all pour React Router
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.api import router
from backend.model import azure_llm_chat


###############################################################################
# ──  Configuration CORS
###############################################################################
origins = [
    "https://klintiawebaccess.azurewebsites.net",
    "http://localhost:5173",
    "*"                                # retire‑le si tu veux restreindre
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

###############################################################################
# ──  Routes API
###############################################################################
app.include_router(router, prefix="/api", tags=["api"])

@app.get("/ping")
def ping():
    """Endpoint de santé (Azure Health Check)."""
    return {"status": "ok"}

###############################################################################
# ──  Montage des fichiers statiques React
###############################################################################
SPA_PATH = Path(__file__).parent / "static"          # <backend>/static

if SPA_PATH.exists():
    app.mount("/static", StaticFiles(directory=SPA_PATH), name="static")

    # Catch‑all : toute URL qui n’est pas /api/* renvoie index.html
    @app.get("/{full_path:path}")
    async def spa_router(full_path: str):
        file = SPA_PATH / full_path
        return FileResponse(file if file.exists() else SPA_PATH / "index.html")

###############################################################################
# ──  Page racine : petit test Azure OpenAI
###############################################################################
@app.get("/")
def read_root():
    question = "Test"
    messages = [{"role": "user", "content": question}]
    answer = azure_llm_chat(messages)
    return {"question": question, "answer": answer}
