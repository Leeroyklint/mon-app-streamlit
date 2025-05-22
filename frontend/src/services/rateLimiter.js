const QUOTAS = {
    "GPT 4o": { rpm: 48 },
    "GPT 4o-mini": { rpm: 2_500 },
    "GPT o1": { rpm: 100 },
    "GPT o1-mini": { rpm: 100 },
    "GPT o3-mini": { rpm: 150 },
    "GPT 4.1-mini": { rpm: 150 },
    "GPT 4.1": { rpm: 150 },
};
const calls = {};
/**
 * Si un slot est libre → retourne 0.
 * Sinon retourne le temps à attendre en **millisecondes**.
 */
export function reserve(family = "GPT 4o") {
    const q = QUOTAS[family];
    if (!q)
        return 0; // famille inconnue → pas de limite
    const now = Date.now() / 1_000;
    const arr = (calls[family] ||= []).filter(t => now - t < 60);
    if (arr.length < q.rpm) {
        arr.push(now);
        calls[family] = arr;
        return 0;
    }
    const wait = 60 - (now - arr[0]) + 0.05;
    return Math.ceil(wait * 1_000); // délai en ms
}
