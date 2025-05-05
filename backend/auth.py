"""
Décode les infos utilisateur quelle que soit la forme
(Access‑Token *ou* Client‑Principal).
"""

import base64, json, jwt
from fastapi import Request, HTTPException

# ------------------------------------------------------------
# helpers internes
# ------------------------------------------------------------
def _decode_access_token(tok: str) -> dict | None:
    try:
        claims = jwt.decode(tok,
                            algorithms=["RS256"],
                            options={"verify_signature": False})
        return {
            "entra_oid": claims.get("entra_oid") or claims.get("oid") or claims.get("sub"),
            "name": (
                claims.get("name")
                or claims.get("preferred_username")
                or claims.get("upn")
                or claims.get("email")
            ),
        }
    except Exception:
        return None


def _decode_client_principal(b64: str) -> dict | None:
    try:
        data = json.loads(base64.b64decode(b64))
        claims = {c["typ"]: c["val"] for c in data["claims"]}
        return {
            "entra_oid": claims.get("oid") or claims.get("sub"),
            "name": (
                claims.get("name")
                or claims.get("preferred_username")
                or claims.get("upn")
                or claims.get("email")
            ),
        }
    except Exception:
        return None


# ------------------------------------------------------------
# dépendance FastAPI
# ------------------------------------------------------------
def get_current_user(req: Request) -> dict:
    """
    • DEV local : front envoie “test2” → user bidon
    • PROD      : on tente Access‑Token puis Client‑Principal
    """
    tok = req.headers.get("X-Ms-Token-Aad-Access-Token")
    if tok and tok != "test2":
        user = _decode_access_token(tok)
        if user and user["entra_oid"]:
            return user

    cp = req.headers.get("X-MS-CLIENT-PRINCIPAL")
    if cp:
        user = _decode_client_principal(cp)
        if user and user["entra_oid"]:
            return user

    if tok == "test2":  # jeton dev
        return {"entra_oid": "dev‑user", "name": "Dev User"}

    raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
