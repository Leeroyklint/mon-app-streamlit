"""
Point d’entrée FastAPI – sert l’API **et** la Single‑Page‑App React
(cf. npm run build + copie de frontend/dist → backend/static).

• Liste « origins » codée en dur pour CORS
• Catch‑all pour React Router
"""

from pathlib import Path
from backend import logging_config  
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
    "http://localhost:5173",                      # dev local
    "https://klintiawebaccess.azurewebsites.net", # prod
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
    """Endpoint de santé (Azure Health Check)."""
    return {"status": "ok"}

@app.get("/api/test")          # démo Azure LLM (hors SPA)
def sample_llm_call():
    question = "Test"
    messages = [{"role": "user", "content": question}]
    answer = azure_llm_chat(messages)
    return {"question": question, "answer": answer}

###############################################################################
# ──  Montage des fichiers statiques React
###############################################################################
SPA_PATH = Path(__file__).parent / "static"       # => backend/static (copie de frontend/dist)

if SPA_PATH.exists():
    # 1)  Monte le dossier assets EXACTEMENT à /assets
    assets_dir = SPA_PATH / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # 2)  Catch‑all : toute URL non /api/* renvoie soit le fichier demandé,
    #    soit index.html (pour React Router)
    @app.get("/{full_path:path}")
    async def spa_router(full_path: str):
        file_path = SPA_PATH / full_path
        return FileResponse(file_path if file_path.is_file() else SPA_PATH / "index.html")
