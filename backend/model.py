"""
Wrapper Azure OpenAI – multi-déploiements, rotation « on fail », quota local RPM,
streaming + sync.
"""

from __future__ import annotations

import os, time, random, json, threading
from collections import defaultdict, deque
from typing import Dict, Deque, Iterable, List, Tuple

import requests
from dotenv import load_dotenv

# ───────────────────────────────  .env
load_dotenv()

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

# ─── SYNC  (remplace entièrement azure_llm_chat)
def azure_llm_chat(messages: list[dict], model: str = "GPT 4o") -> str:
    cfg = RAW_MODELS[model]
    if cfg.get("merge_system_into_user"):
        messages = _merge_system(messages)

    global_attempt = 0
    while global_attempt < len(cfg["env_keys"]):     # on fera au max un tour complet
        api_key, ep, rpm = _pickup_creds(model)
        _wait_slot(ep, rpm)

        for local_try in range(MAX_LOCAL_RETRY):
            payload = {
                "messages": messages,
                cfg["payload_key"]: cfg["max_tokens"],
                "model": ep.rsplit("/", 3)[-3],
            }
            try:
                r = requests.post(ep, headers={"api-key": api_key,
                                               "Content-Type": "application/json"},
                                   json=payload, timeout=60)
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]

            except requests.HTTPError as exc:
                if r.status_code in (429, 503):
                    _sleep(r, local_try)
                    continue                # ↺ même endpoint
                raise RuntimeError(f"Azure {r.status_code}: {exc}") from exc

            except requests.RequestException:
                _sleep(r, local_try)
                continue                    # ↺ même endpoint

        # après 3 échecs sur ce déploiement → suivant
        _rotate_on_fail(model)
        global_attempt += 1

    raise RuntimeError(f"Toutes les tentatives ont échoué pour {model}")

# ╔════════════════════════════  STREAM  ════════════════════════════════════╗
def azure_llm_chat_stream(messages: list[dict], model: str = "GPT 4o"):
    cfg = RAW_MODELS[model]
    if cfg.get("merge_system_into_user"):
        messages = _merge_system(messages)

    global_rotations = 0
    while global_rotations < len(cfg["env_keys"]):
        api_key, ep, rpm = _pickup_creds(model)
        _wait_slot(ep, rpm)

        payload = {
            "messages": messages,
            cfg["payload_key"]: cfg["max_tokens"],
            "model": ep.rsplit("/", 3)[-3],
            "stream": True,
        }
        try:
            with requests.post(ep, headers={"api-key": api_key,
                                            "Content-Type": "application/json"},
                               json=payload, stream=True, timeout=90) as resp:
                resp.raise_for_status()
                for raw in resp.iter_lines(decode_unicode=True):
                    if not raw or not raw.startswith("data: "): continue
                    chunk = raw[6:]
                    if chunk.strip() == "[DONE]": return
                    data = json.loads(chunk)
                    if data.get("choices"):
                        delta = data["choices"][0]["delta"].get("content")
                        if delta: yield delta
                return                                # fin normale

        except (requests.HTTPError, requests.RequestException) as exc:
            # 429/503 ou réseau → on re-essaie 3 fois localement, sinon rotate
            _rotate_on_fail(model)
            global_rotations += 1
            continue

    raise RuntimeError(f"Toutes les tentatives de streaming ont échoué pour {model}")