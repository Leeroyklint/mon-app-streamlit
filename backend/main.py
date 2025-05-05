from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.api import router   # <= ton router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://klintiawebaccess.azurewebsites.net",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api", tags=["api"])

SPA_PATH = Path(__file__).parent / "static"

if SPA_PATH.exists():
    app.mount("/static", StaticFiles(directory=SPA_PATH), name="static")

    @app.get("/")
    async def spa_root():
        return FileResponse(SPA_PATH / "index.html")

    @app.get("/{full_path:path}")
    async def spa_router(full_path: str):
        file = SPA_PATH / full_path
        return FileResponse(file if file.exists() else SPA_PATH / "index.html")
