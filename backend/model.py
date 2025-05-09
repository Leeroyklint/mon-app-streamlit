import os
import time
import random
from typing import List

import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# 🔧 Central model registry – ajoute / modifie tous les déploiements ici
# ---------------------------------------------------------------------------
MODEL_CONFIG = {
    # 4-series (o) ----------------------------------------------------------
    "GPT 4o-mini": {
        "api_key_env": "AZ_OPENAI_API_4o_mini_ada_002",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_4o_mini",
        "payload_key": "max_tokens",
        "max_tokens": 4096,
        "deployment": "4o-mini",
    },
    "GPT 4o": {
        "api_key_env": "AZ_OPENAI_API_4o",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_4o",
        "payload_key": "max_tokens",
        "max_tokens": 4096,
        "deployment": "4o",
    },
    # 4.1 NEW --------------------------------------------------------------
    "GPT 4.1-mini": {
        "api_key_env": "AZ_OPENAI_API_4_1_mini",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_4_1_mini",
        "payload_key": "max_completion_tokens",
        "max_tokens": 8192,
        "deployment": "gpt-4.1-mini",
    },
    "GPT 4.1": {
        "api_key_env": "AZ_OPENAI_API_4_1",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_4_1",
        "payload_key": "max_completion_tokens",
        "max_tokens": 8192,
        "deployment": "gpt-4.1",
    },
    # 1-series --------------------------------------------------------------
    "GPT o1-mini": {
        "api_key_env": "AZ_OPENAI_API_o1_mini",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o1_mini",
        "payload_key": "max_completion_tokens",
        "max_tokens": 40000,
        "deployment": "o1-mini",
        "merge_system_into_user": True,  # preview constraint
    },
    "GPT o1": {
        "api_key_env": "AZ_OPENAI_API_o1",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o1",
        "payload_key": "max_completion_tokens",
        "max_tokens": 40000,
        "deployment": "o1",
        "merge_system_into_user": True,
    },
    # 3-series --------------------------------------------------------------
    "GPT o3-mini": {
        "api_key_env": "AZ_OPENAI_API_o3_mini",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o3_mini",
        "payload_key": "max_completion_tokens",
        "max_tokens": 100000,  # unofficial preview limit
        "deployment": "o3-mini",
        "merge_system_into_user": False,
    },
}

# ---------------------------------------------------------------------------
# 🚀 Thin convenience wrapper around Azure OpenAI chat-completions endpoint
# ---------------------------------------------------------------------------


def azure_llm_chat(
    messages: List[dict],
    model: str = "GPT 4o-mini",
    *,
    max_retries: int = 6,
    base_backoff: float = 1.2,
) -> str:
    """
    Appelle Azure OpenAI → retourne le contenu du message assistant.

    • Back-off exponentiel sur les 429 « Too Many Requests »
    • Respecte le header Retry-After s’il est présent
    • Garde l’API synchrone/simple pour le reste de l’application
    """
    if model not in MODEL_CONFIG:
        raise ValueError(
            f"Unknown model '{model}'. Available: {', '.join(MODEL_CONFIG)}"
        )

    cfg = MODEL_CONFIG[model]
    api_key = os.getenv(cfg["api_key_env"])
    endpoint = os.getenv(cfg["endpoint_env"])

    if not api_key or not endpoint:
        missing = [k for k, v in (("API key", api_key), ("endpoint", endpoint)) if not v]
        raise EnvironmentError(
            f"Missing {', '.join(missing)} for {model}. Check your .env file."
        )

    # ▸ Quelques previews (o-/o1) imposent de fusionner le rôle system dans le premier user
    if cfg.get("merge_system_into_user"):
        merged: List[dict] = []
        for msg in messages:
            if msg["role"] == "system":
                if merged and merged[-1]["role"] == "user":
                    merged[-1]["content"] = msg["content"] + "\n\n" + merged[-1][
                        "content"
                    ]
                else:
                    merged.append({"role": "user", "content": msg["content"]})
            else:
                merged.append(msg)
        messages = merged

    payload = {
        "messages": messages,
        cfg["payload_key"]: cfg["max_tokens"],
        "model": cfg["deployment"],
    }

    headers = {"Content-Type": "application/json", "api-key": api_key}

    # ---------- Retry / back-off ----------
    attempt = 0
    while True:
        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except requests.HTTPError as exc:
            status = resp.status_code if "resp" in locals() else "?"
            # 429 → back-off exponentiel + jitter, puis retry
            if status == 429 and attempt < max_retries:
                retry_after = float(resp.headers.get("Retry-After", "0")) or base_backoff
                sleep_for = retry_after * (base_backoff ** attempt) + random.random()
                attempt += 1
                time.sleep(sleep_for)
                continue
            # autre erreur ou retries épuisés → on lève
            raise RuntimeError(f"Azure OpenAI error {status}: {exc}") from exc
        except requests.RequestException as exc:
            # timeout / réseau : même back-off
            if attempt < max_retries:
                time.sleep(base_backoff * (base_backoff ** attempt))
                attempt += 1
                continue
            raise RuntimeError(f"Azure OpenAI error: {exc}") from exc
