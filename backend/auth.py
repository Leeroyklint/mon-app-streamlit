"""
Résout l’utilisateur courant :
• DEV   : le front envoie « test2 »
• PROD  : on lit d’abord Access‑Token, sinon Client‑Principal
"""

import base64, json, jwt
from fastapi import Request, HTTPException
import logging
log = logging.getLogger("auth")

# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------
def _decode_access_token(tok: str) -> dict | None:
    try:
        c = jwt.decode(tok,
                       algorithms=["RS256"],
                       options={"verify_signature": False})
        return {
            "entra_oid": c.get("entra_oid") or c.get("oid") or c.get("sub"),
            "name": (
                c.get("name")
                or c.get("preferred_username")
                or c.get("upn")
                or c.get("email")
            ),
        }
    except Exception:
        return None


# URI long utilisé par Easy Auth dans X‑MS‑CLIENT‑PRINCIPAL
OID_CLAIM = "http://schemas.microsoft.com/identity/claims/objectidentifier"

def _decode_client_principal(b64: str) -> dict | None:
    try:
        data = json.loads(base64.b64decode(b64 + "==="))   # padding au cas où
        claims = {c["typ"]: c["val"] for c in data["claims"]}
        return {
            "entra_oid": claims.get("oid") or claims.get(OID_CLAIM) or claims.get("sub"),
            "name": (
                claims.get("name")
                or claims.get("preferred_username")
                or claims.get("upn")
                or claims.get("email")
            ),
        }
    except Exception:
        return None


# ------------------------------------------------------------------
# dépendance FastAPI
# ------------------------------------------------------------------
def get_current_user(req: Request) -> dict:
    """
    Retourne un dict {entra_oid, name} ou lève 401.
    """
    tok = req.headers.get("X-Ms-Token-Aad-Access-Token")
    if tok and tok != "test2":
        u = _decode_access_token(tok)
        log.info("AccessToken user=%s", u)
        if u and u["entra_oid"]:
            return u

    cp = req.headers.get("X-MS-CLIENT-PRINCIPAL")        # présent quand user loggué
    if cp:
        u = _decode_client_principal(cp)
        log.info("ClientPrincipal user=%s", u)
        if u and u["entra_oid"]:
            return u

    if tok == "test2":  
        log.warning("DEV token utilisé")                                  # mode dev local
        return {"entra_oid": "user-123", "name": "TestUser"}

    raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
