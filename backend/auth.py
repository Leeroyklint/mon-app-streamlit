from fastapi import Request, HTTPException
import jwt


def get_current_user(request: Request) -> dict:
    """
    • Dev local  : tok == "test2"  → user fictif
    • Prod Azure : Easy Auth ajoute X‑Ms-Token-Aad-Access-Token
    On renvoie toujours un dict **{entra_oid, name}**.
    """
    tok = request.headers.get("X-Ms-Token-Aad-Access-Token")
    if not tok:
        raise HTTPException(status_code=401, detail="Utilisateur non authentifié")

    try:
        # ── 1)  DEV
        if tok == "test2":
            return {"entra_oid": "user-123", "name": "TestUser"}

        # ── 2)  PROD Azure
        claims = jwt.decode(tok, algorithms=["RS256"], options={"verify_signature": False})

        return {
            "entra_oid": claims.get("entra_oid") or claims.get("oid") or claims.get("sub"),
            "name": (
                claims.get("name")
                or claims.get("preferred_username")
                or claims.get("upn")
                or "Utilisateur"
            ),
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalide : {e}")
