import os
import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# 🔧 Central model registry – add every Azure-OpenAI deployment here
# ---------------------------------------------------------------------------
MODEL_CONFIG: dict[str, dict] = {
    # ────────────────────────────── 4-series (legacy) ─────────────────────
    "GPT 4o-mini": {
        "api_key_env":   "AZ_OPENAI_API_4o_mini_ada_002",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_4o_mini",
        "payload_key":   "max_tokens",
        "max_tokens":    4096,
        "deployment":    "4o-mini",
    },
    "GPT 4o": {
        "api_key_env":   "AZ_OPENAI_API_4o",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_4o",
        "payload_key":   "max_tokens",
        "max_tokens":    4096,
        "deployment":    "4o",
    },

    # ────────────────────────────── 4-point-1 NEW ─────────────────────────
    "GPT 4.1-mini": {                     # ← nouveau
        "api_key_env":   "AZ_OPENAI_API_4_1_mini",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_4_1_mini",
        "payload_key":   "max_tokens",
        "max_tokens":    4096,
        "deployment":    "gpt-4.1-mini",
    },
    "GPT 4.1": {                          # ← nouveau
        "api_key_env":   "AZ_OPENAI_API_4_1",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_4_1",
        "payload_key":   "max_tokens",
        "max_tokens":    4096,
        "deployment":    "gpt-4.1",
    },

    # ────────────────────────────── 1-series (preview) ────────────────────
    "GPT o1-mini": {
        "api_key_env":   "AZ_OPENAI_API_o1_mini",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_o1_mini",
        "payload_key":   "max_completion_tokens",
        "max_tokens":    40000,
        "deployment":    "o1-mini",
        "merge_system_into_user": True,   # preview quirk
    },
    "GPT o1": {
        "api_key_env":   "AZ_OPENAI_API_o1",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_o1",
        "payload_key":   "max_completion_tokens",
        "max_tokens":    40000,
        "deployment":    "o1",
        "merge_system_into_user": True,
    },

    # ────────────────────────────── 3-series ──────────────────────────────
    "GPT o3-mini": {
        "api_key_env":   "AZ_OPENAI_API_o3_mini",
        "endpoint_env":  "AZ_OPENAI_ENDPOINT_o3_mini",
        "payload_key":   "max_completion_tokens",
        "max_tokens":    100000,
        "deployment":    "o3-mini",
        "merge_system_into_user": False,
    },
}

# ---------------------------------------------------------------------------
# 🚀 Convenience wrapper around Azure OpenAI chat-completions endpoint
# ---------------------------------------------------------------------------

def azure_llm_chat(messages: list[dict], model: str = "GPT 4o-mini") -> str:
    """
    Send a ChatML conversation to Azure OpenAI and return the reply.
    `model` must be one of the keys of MODEL_CONFIG.
    """
    if model not in MODEL_CONFIG:
        raise ValueError(f"Unknown model '{model}'. Available: {', '.join(MODEL_CONFIG)}")

    cfg = MODEL_CONFIG[model]
    api_key  = os.getenv(cfg["api_key_env"])
    endpoint = os.getenv(cfg["endpoint_env"])

    if not api_key or not endpoint:
        missing = [n for n,v in (("API key",api_key),("endpoint",endpoint)) if not v]
        raise EnvironmentError(
            f"Missing {', '.join(missing)} for {model}. Check your environment variables."
        )

    # preview “o-series” quirk: merge system → first user message
    if cfg.get("merge_system_into_user"):
        merged: list[dict] = []
        for m in messages:
            if m["role"] == "system":
                if merged and merged[-1]["role"] == "user":
                    merged[-1]["content"] = m["content"] + "\n\n" + merged[-1]["content"]
                else:
                    merged.append({"role": "user", "content": m["content"]})
            else:
                merged.append(m)
        messages = merged

    payload = {
        "messages": messages,
        cfg["payload_key"]: cfg["max_tokens"],
        "model": cfg["deployment"],
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": api_key,
    }

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except requests.RequestException as exc:
        status = resp.status_code if "resp" in locals() else "?"
        raise RuntimeError(f"Azure OpenAI error {status}: {exc}") from exc
