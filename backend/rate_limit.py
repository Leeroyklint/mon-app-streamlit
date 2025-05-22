"""
Rate-limit « intelligent » par *famille* de modèle Azure OpenAI
───────────────────────────────────────────────────────────────
─ RPM = requêtes par minute
─ TPM = jetons (par minute, entrée + sortie)

Le bucket se recharge toutes les 60 s.  Si un appel ferait
déborder la limite on dort exactement le temps restant avant
le prochain reset, puis on consomme.
"""

from __future__ import annotations
import time, threading

# ──────────────────────────── quotas par famille
_FAMILIES = {
    "4o":       dict(rpm=48,    tpm=8_000),
    "4o-mini":  dict(rpm=2_500, tpm=250_000),
    "o1":       dict(rpm=100,   tpm=600_000),
    "o1-mini":  dict(rpm=100,   tpm=1_000_000),
    "o3-mini":  dict(rpm=90,    tpm=90_000),     # file d’attente 90 k jetons
    "4.1-mini": dict(rpm=150,   tpm=150_000),
    "4.1":      dict(rpm=150,   tpm=150_000),
}

# ──────────────────────────── bucket interne
class _Bucket:
    def __init__(self, rpm: int, tpm: int):
        self.rpm, self.tpm = rpm, tpm
        self.lock = threading.Lock()
        self._reset()

    def _reset(self) -> None:
        self.start   = time.time()
        self.reqs    = 0
        self.tokens  = 0

    def charge(self, n_tokens: int) -> None:
        with self.lock:
            now = time.time()
            elapsed = now - self.start

            # reset chaque minute glissante
            if elapsed >= 60:
                self._reset()

            # faut-il attendre ?
            will_reqs   = self.reqs   + 1
            will_tokens = self.tokens + n_tokens
            if will_reqs > self.rpm or will_tokens > self.tpm:
                sleep_for = 60 - elapsed
                time.sleep(max(0.0, sleep_for))
                self._reset()                       # minute suivante

            # on consomme
            self.reqs   += 1
            self.tokens += n_tokens

# ──────────────────────────── buckets par famille
_BUCKETS = {fam: _Bucket(**q) for fam, q in _FAMILIES.items()}

def charge(family: str, n_tokens: int) -> None:
    """
    Bloque évent. jusqu’à ce qu’il soit légal d’envoyer.
    Lève KeyError si la famille n’est pas déclarée (débogage).
    """
    _BUCKETS[family].charge(n_tokens)
