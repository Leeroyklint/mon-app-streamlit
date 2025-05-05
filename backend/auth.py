# backend/auth.py
from fastapi import Request, HTTPException
import jwt, os


def _decode(token: str):
    # Azure EasyAuth a déjà validé la signature → on ne rechigne pas
    return jwt.decode(token, algorithms=["RS256"],
                      options={"verify_signature": False})


def get_current_user(request: Request):
    """
    - LOCAL_MODE=1 ⟹ renvoie un user fictif
    - sinon ⟹ lit le header ajouté par EasyAuth
    """
    if os.getenv("LOCAL_MODE") == "1":
        return {"entra_oid": "user-123", "name": "DevUser"}

    token = request.headers.get("X-Ms-Token-Aad-Access-Token")
    if not token:
        raise HTTPException(status_code=401, detail="Unauthenticated")
    try:
        return _decode(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
