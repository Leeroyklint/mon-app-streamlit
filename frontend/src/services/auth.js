/**
 * Construit l’en‑tête d’auth Azure AD.
 *
 * • En prod ( *.azurewebsites.net ) : le reverse‑proxy ajoute déjà le JWT
 *   → on renvoie juste les extra‑headers éventuels.
 * • En local : on ajoute X‑Ms‑Token‑Aad‑Access‑Token avec
 *   VITE_DEV_TOKEN (défini dans .env.local) ou "test2" par défaut.
 */
export function authHeaders(extra = {}) {
    const isProd = window.location.hostname.endsWith(".azurewebsites.net");
    if (isProd)
        return { ...extra };
    const token = import.meta.env.VITE_DEV_TOKEN ?? "test2";
    return { ...extra, "X-Ms-Token-Aad-Access-Token": token };
}
