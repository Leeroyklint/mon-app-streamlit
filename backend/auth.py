from fastapi import Request, HTTPException
import base64, json, jwt


def _from_access_token(tok: str) -> dict | None:
    try:
        claims = jwt.decode(tok, algorithms=["RS256"], options={"verify_signature": False})
        return {
            "entra_oid": claims.get("entra_oid") or claims.get("oid") or claims.get("sub"),
            "name": (
                claims.get("name")
                or claims.get("preferred_username")
                or claims.get("upn")
            ),
        }
    except Exception:
        return None


def _from_client_principal(b64: str) -> dict | None:
    try:
        decoded = base64.b64decode(b64).decode()
        data = json.loads(decoded)
        return {
            "entra_oid": next((c["val"] for c in data["claims"] if c["typ"] in ("oid", "sub")), None),
            "name": next(
                (
                    c["val"]
                    for c in data["claims"]
                    if c["typ"] in ("name", "preferred_username", "upn")
                ),
                None,
            ),
        }
    except Exception:
        return None


def get_current_user(req: Request) -> dict:
    """
    1. Dev local        : header absent  → “test2” géré dans front
    2. Prod Easy Auth   :
       • d’abord X‑Ms‑Token‑Aad‑Access-Token (si activé)
       • sinon X‑MS‑CLIENT‑PRINCIPAL (toujours présent)
    """
    tok = req.headers.get("X-Ms-Token-Aad-Access-Token")
    if tok and tok != "test2":
        user = _from_access_token(tok)
        if user and user["entra_oid"]:
            return user

    cp = req.headers.get("X-MS-CLIENT-PRINCIPAL")
    if cp:
        user = _from_client_principal(cp)
        if user and user["entra_oid"]:
            return user

    # ---- dev ou échec ----
    if tok == "test2":                       # jeton local factice
        return {"entra_oid": "user-123", "name": "TestUser"}

    raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
