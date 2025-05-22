"""
Wrapper Azure OpenAI – multi-déploiements, rotation « on fail », quota local RPM,
streaming + sync.
"""

from __future__ import annotations

import os, time, random, json, threading, base64, logging
from collections import defaultdict, deque
from typing import Dict, Deque, Iterable, List, Tuple, Generator   # ← +Generator

import requests
from dotenv import load_dotenv

# ───────────────────────────────  .env
load_dotenv()

# ─────── petit logger (optionnel) ───────
logger = logging.getLogger(__name__)

# ╔══════════════════════════════  REGISTRY  ══════════════════════════════╗
#  Pour chaque famille : liste (api_key_env, endpoint_env) + quotas.
# ╚═══════════════════════════════════════════════════════════════════════╝
RAW_MODELS: Dict[str, Dict[str, object]] = {
    # ─────────── GPT-4o ───────────
    "GPT 4o": {
        "env_keys": [
            ("AZ_OPENAI_API_4o", "AZ_OPENAI_ENDPOINT_4o"),
            ("AZ_OPENAI_API_4o", "AZ_OPENAI_ENDPOINT_4o_2"),
            ("AZ_OPENAI_API_4o", "AZ_OPENAI_ENDPOINT_4o_3"),
        ],
        "max_tokens": 4_096,
        "rpm": 48,
        "tpm": 8_000,
        "payload_key": "max_tokens",
    },
    "GPT 4o-mini": {
        "env_keys": [
            ("AZ_OPENAI_API_4o_mini_ada_002", "AZ_OPENAI_ENDPOINT_4o_mini"),
            ("AZ_OPENAI_API_4o_mini_ada_002", "AZ_OPENAI_ENDPOINT_4o_mini_2"),
            ("AZ_OPENAI_API_4o_mini_ada_002", "AZ_OPENAI_ENDPOINT_4o_mini_3"),
        ],
        "max_tokens": 4_096,
        "rpm": 2_500,
        "tpm": 250_000,
        "payload_key": "max_tokens",
    },
    # ─────────── GPT-o1 ───────────
    "GPT o1": {
        "env_keys": [
            ("AZ_OPENAI_API_o1", "AZ_OPENAI_ENDPOINT_o1"),
            ("AZ_OPENAI_API_o1", "AZ_OPENAI_ENDPOINT_o1_2"),
            ("AZ_OPENAI_API_o1", "AZ_OPENAI_ENDPOINT_o1_3"),
        ],
        "max_tokens": 40_000,
        "rpm": 100,
        "tpm": 600_000,
        "payload_key": "max_completion_tokens",
        "merge_system_into_user": True,
    },
    "GPT o1-mini": {
        "env_keys": [
            ("AZ_OPENAI_API_o1_mini", "AZ_OPENAI_ENDPOINT_o1_mini"),
            ("AZ_OPENAI_API_o1_mini", "AZ_OPENAI_ENDPOINT_o1_mini_2"),
            ("AZ_OPENAI_API_o1_mini", "AZ_OPENAI_ENDPOINT_o1_mini_3"),
        ],
        "max_tokens": 40_000,
        "rpm": 100,
        "tpm": 1_000_000,
        "payload_key": "max_completion_tokens",
        "merge_system_into_user": True,
    },
    # ─────────── GPT-o3-mini ──────
    "GPT o3-mini": {
        "env_keys": [
            ("AZ_OPENAI_API_o3_mini", "AZ_OPENAI_ENDPOINT_o3_mini"),
            ("AZ_OPENAI_API_o3_mini", "AZ_OPENAI_ENDPOINT_o3_mini_2"),
            ("AZ_OPENAI_API_o3_mini", "AZ_OPENAI_ENDPOINT_o3_mini_3"),
        ],
        "max_tokens": 100_000,
        "rpm": 150,
        "tpm": 90_000,
        "payload_key": "max_completion_tokens",
    },
    # ─────────── GPT-4.1 ───────────
    "GPT 4.1-mini": {
        "env_keys": [
            ("AZ_OPENAI_API_4_1_mini", "AZ_OPENAI_ENDPOINT_4_1_mini"),
            ("AZ_OPENAI_API_4_1_mini", "AZ_OPENAI_ENDPOINT_4_1_mini_2"),
            ("AZ_OPENAI_API_4_1_mini", "AZ_OPENAI_ENDPOINT_4_1_mini_3"),
        ],
        "max_tokens": 8_192,
        "rpm": 150,
        "tpm": 150_000,
        "payload_key": "max_completion_tokens",
    },
    "GPT 4.1": {
        "env_keys": [
            ("AZ_OPENAI_API_4_1", "AZ_OPENAI_ENDPOINT_4_1"),
            ("AZ_OPENAI_API_4_1", "AZ_OPENAI_ENDPOINT_4_1_2"),
            ("AZ_OPENAI_API_4_1", "AZ_OPENAI_ENDPOINT_4_1_3"),
        ],
        "max_tokens": 8_192,
        "rpm": 150,
        "tpm": 150_000,
        "payload_key": "max_completion_tokens",
    },
}

# ╔════════════════════════════  RATE LIMIT (in-proc, par endpoint) ═════════╗
_lock_rl = threading.Lock()
_last_calls: Dict[str, Deque[float]] = defaultdict(deque)  # endpoint → ts <60 s

def _wait_slot(endpoint: str, rpm: int) -> None:
    """Bloque tant qu’aucun « crédit » RPM libre pour cet endpoint."""
    with _lock_rl:
        now = time.time()
        q = _last_calls[endpoint]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) < rpm:
            q.append(now)
            return
        delay = 60 - (now - q[0]) + 0.05
    time.sleep(delay)

# ╔════════════════════════════  ROUND-ROBIN  « on fail »  ══════════════════╗
_lock_ptr = threading.Lock()
_ptr: Dict[str, int] = defaultdict(int)      # famille → index actuel

def _pickup_creds(fam: str) -> Tuple[str, str, int]:
    idx = _ptr[fam]
    api_env, end_env = RAW_MODELS[fam]["env_keys"][idx]
    api_key  = os.getenv(api_env)
    endpoint = os.getenv(end_env)
    if not api_key or not endpoint:
        raise RuntimeError(f"Env manquant : {api_env}/{end_env}")
    rpm = RAW_MODELS[fam]["rpm"]
    return api_key, endpoint, rpm

def _rotate_on_fail(fam: str) -> None:
    with _lock_ptr:
        _ptr[fam] = (_ptr[fam] + 1) % len(RAW_MODELS[fam]["env_keys"])

# ╔════════════════════════════  OUTILS Divers  ═════════════════════════════╗
def _merge_system(msgs: List[dict]) -> List[dict]:
    merged: List[dict] = []
    for m in msgs:
        if m["role"] == "system":
            if merged and merged[-1]["role"] == "user":
                merged[-1]["content"] = m["content"] + "\n\n" + merged[-1]["content"]
            else:
                merged.append({"role": "user", "content": m["content"]})
        else:
            merged.append(m)
    return merged

# ╔════════════════════════════  SYNC  ══════════════════════════════════════╗
# ─── CONST
MAX_LOCAL_RETRY = 3          # ⇐ 1 essai + 2 retry = 3 au total
BASE_BACKOFF    = 1.4        # facteur d’attente exponentielle

# ─── helper
def _sleep(resp, attempt):
    hdr = resp.headers.get("Retry-After")
    wait = float(hdr) if hdr else BASE_BACKOFF * (BASE_BACKOFF ** attempt)
    time.sleep(wait + random.random())

# ───────────────────────── helper vision ────────────────────────────────
def _requires_vision(msgs: List[dict]) -> bool:
    """
    True si au moins un message contient un fragment {'type':'image_url', …}.
    """
    for m in msgs:
        c = m.get("content")
        if isinstance(c, list):                    # format vision
            if any(part.get("type") == "image_url" for part in c):
                return True
    return False

# ─── SYNC  (remplace entièrement azure_llm_chat)
def azure_llm_chat(messages: List[dict],
                   model: str = "GPT 4o") -> Tuple[str, dict]:
    """
    Retourne (content, headers) où headers = {
        "x-llm-model":      "famille choisie",
        "x-llm-deployment": "nom exact du déploiement"
    }
    """
    # ── Bascule auto Vision → GPT 4o
    if _requires_vision(messages) and not model.startswith("GPT 4o"):
        model = "GPT 4o"

    cfg = RAW_MODELS[model]
    if cfg.get("merge_system_into_user"):
        messages = _merge_system(messages)

    global_attempt = 0
    while global_attempt < len(cfg["env_keys"]):
        api_key, ep, rpm = _pickup_creds(model)
        _wait_slot(ep, rpm)

        for local_try in range(MAX_LOCAL_RETRY):
            payload = {
                "messages": messages,
                cfg["payload_key"]: cfg["max_tokens"],
                "model": ep.rsplit("/", 3)[-3],
            }
            try:
                r = requests.post(
                    ep,
                    headers={"api-key": api_key, "Content-Type": "application/json"},
                    json=payload, timeout=60,
                )
                r.raise_for_status()

                data        = r.json()
                deployment  = data.get("model") or payload["model"]
                headers_out = {
                    "x-llm-model":      model,
                    "x-llm-deployment": deployment,
                }
                logger.info("LLM %s via %s (%s tok in/out)",
                            model, deployment, data.get("usage", {}))
                return data["choices"][0]["message"]["content"], headers_out

            except requests.HTTPError as exc:
                if r.status_code in (429, 503):
                    _sleep(r, local_try); continue
                raise RuntimeError(f"Azure {r.status_code}: {exc}") from exc
            except requests.RequestException:
                _sleep(r, local_try); continue

        _rotate_on_fail(model)
        global_attempt += 1

    raise RuntimeError(f"Toutes les tentatives ont échoué pour {model}")

# ╔════════════════════════════  STREAM  ══════════════════════════════════╗
def azure_llm_chat_stream(messages: List[dict],
                          model: str = "GPT 4o") -> Tuple[Generator[str, None, None], dict]:
    """
    Retourne (generator, headers) – headers idem que pour azure_llm_chat.
    """
    # ── Bascule auto Vision → GPT 4o
    if _requires_vision(messages) and not model.startswith("GPT 4o"):
        model = "GPT 4o"

    cfg = RAW_MODELS[model]
    if cfg.get("merge_system_into_user"):
        messages = _merge_system(messages)

    global_rot = 0
    while global_rot < len(cfg["env_keys"]):
        api_key, ep, rpm = _pickup_creds(model)
        _wait_slot(ep, rpm)

        payload = {
            "messages": messages,
            cfg["payload_key"]: cfg["max_tokens"],
            "model": ep.rsplit("/", 3)[-3],
            "stream": True,
        }
        deployment = payload["model"]
        headers_out = {"x-llm-model": model, "x-llm-deployment": deployment}

        try:
            resp = requests.post(
                ep,
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json=payload, stream=True, timeout=90,
            )
            resp.raise_for_status()

            def _gen():
                for raw in resp.iter_lines(decode_unicode=True):
                    if not raw or not raw.startswith("data: "):
                        continue
                    chunk = raw[6:]
                    if chunk.strip() == "[DONE]":
                        return
                    data = json.loads(chunk)
                    if data.get("choices"):
                        delta = data["choices"][0]["delta"].get("content")
                        if delta: yield delta
            return _gen(), headers_out

        except (requests.HTTPError, requests.RequestException):
            _rotate_on_fail(model)
            global_rot += 1
            continue

    raise RuntimeError(f"Toutes les tentatives de streaming ont échoué pour {model}")

# ╔════════════════════════════  OCR ‹ GPT-4o vision ›  ════════════════════╗
def gpt4o_ocr(image_bytes: bytes, mime: str = "image/png") -> str:
    """
    Renvoie la transcription exacte de tout le texte présent sur l’image.
    Utilise GPT-4o vision (même déploiement que le chat).
    """
    b64 = base64.b64encode(image_bytes).decode()
    prompt = [
        {"role": "user", "content": [
            {"type": "text",
             "text": "Transcris exactement tout le texte présent sur l'image."},
            {"type": "image_url",
             "image_url": {"url": f"data:{mime};base64,{b64}"}}]}
    ]
    txt, _ = azure_llm_chat(prompt, model="GPT 4o")
    return txt.strip()


# ╔════════════════════════════  DALL·E-3 génération  ══════════════════════╗
def dalle3_generate(prompt: str, size: str = "1024x1024") -> str:
    """
    Génère une image via DALL·E-3 (déploiement Azure) et renvoie l’URL SAS.
    Variables requises dans .env :
      AZ_dall-e-3_API, AZ_dall-e-3_ENDPOINT  (configurées par l’utilisateur)
    """
    api_key  = os.getenv("AZ_dall-e-3_API")
    endpoint = os.getenv("AZ_dall-e-3_ENDPOINT")
    if not api_key or not endpoint:
        raise RuntimeError("Variables AZ_dall-e-3_API / AZ_dall-e-3_ENDPOINT manquantes")

    payload = {"prompt": prompt, "n": 1, "size": size}
    r = requests.post(endpoint, headers={
                      "api-key": api_key, "Content-Type": "application/json"},
                      json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["data"][0]["url"]
