let QUOTAS = {
    "GPT 4o": { rpm: 48 }, // <-- valeurs par défaut (secours)
};
fetch(import.meta.env.VITE_API_URL + "/api/quota", {
    headers: { "Content-Type": "application/json" },
})
    .then(r => r.json())
    .then(q => (QUOTAS = q))
    .catch(() => console.warn("Impossible de charger /quota : on garde le fallback"));
const calls = {};
/**
 * Si un slot est libre → 0 ms ; sinon délai à attendre (ms).
 */
export function reserve(family = "GPT 4o") {
    const rpm = QUOTAS[family]?.rpm;
    if (!rpm)
        return 0; // pas de limite connue
    const now = Date.now() / 1_000;
    const arr = (calls[family] ||= []).filter(t => now - t < 60);
    if (arr.length < rpm) {
        arr.push(now);
        return 0;
    }
    return Math.ceil((60 - (now - arr[0]) + 0.05) * 1_000);
}
