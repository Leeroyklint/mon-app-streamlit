// src/utils/isImagePrompt.ts
const TRIGGER_VERBS = [
    "génère", "générer", "crée", "créer", "dessine", "dessiner",
    "fais", "fais-moi", "montre", "affiche", "produis", "produire",
    "draw", "create", "generate", "show", "make"
];
const IMAGE_KEYWORDS = [
    "image", "illustration", "dessin", "visuel", "photo",
    "picture", "logo", "poster", "meme", "wallpaper", "artwork"
];
/**
 * Renvoie true si le prompt ressemble VRAIMENT à « fais-moi une image ».
 *  - Besoin d’au moins 1 verbe déclencheur ET 1 mot-clé « image ».
 *  - Ignore les questions “comment générer une image …?”
 */
export function isImagePrompt(raw) {
    const t = raw.toLowerCase()
        .replace(/[“”«»"']/g, "") // guillemets → neutre
        .replace(/\s+/g, " ") // espaces multiples
        .trim();
    // filtre les cas « comment générer… » ou « peux-tu expliquer… »
    if (/comment|exp(l|l)iquer|peux-tu/i.test(t))
        return false;
    const hasVerb = TRIGGER_VERBS.some(v => t.startsWith(v) || t.includes(" " + v));
    const hasImgKey = IMAGE_KEYWORDS.some(k => t.includes(k));
    return hasVerb && hasImgKey;
}
