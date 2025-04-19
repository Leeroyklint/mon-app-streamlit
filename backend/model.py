import os
import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# 🔧 Central model registry – add new deployments in one place
# ---------------------------------------------------------------------------
MODEL_CONFIG = {
    # 4‑series --------------------------------------------------------------
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
    # 1‑series --------------------------------------------------------------
    "GPT o1-mini": {
        "api_key_env": "AZ_OPENAI_API_o1_mini",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o1_mini",
        "payload_key": "max_completion_tokens",
        "max_tokens": 40000,  # ≈1 M TPM theoretical
        "deployment": "o1-mini",
        "merge_system_into_user": True,
    },
    "GPT o1": {
        "api_key_env": "AZ_OPENAI_API_o1",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o1",
        "payload_key": "max_completion_tokens",
        "max_tokens": 40000,
        "deployment": "o1",
        "merge_system_into_user": True,
    },
    # 3‑series --------------------------------------------------------------
    "GPT o3-mini": {
        "api_key_env": "AZ_OPENAI_API_o3_mini",
        "endpoint_env": "AZ_OPENAI_ENDPOINT_o3_mini",
        "payload_key": "max_completion_tokens",
        "max_tokens": 100000,  # ≈unofficial preview limit
        "deployment": "o3-mini",
        "merge_system_into_user": False,
    },
}


# ---------------------------------------------------------------------------
# 🚀 Thin convenience wrapper around Azure OpenAI chat‑completions endpoint
# ---------------------------------------------------------------------------

def azure_llm_chat(messages: list[dict], model: str = "GPT 4o-mini") -> str:
    """Send a ChatML conversation to our Azure OpenAI deployment and return the reply.

    Parameters
    ----------
    messages : list[dict]
        Standard ChatML list of dicts – *role* must be one of "system", "user", "assistant".
    model : str, optional
        Friendly model name (see ``MODEL_CONFIG`` keys). Defaults to ``"GPT 4o-mini"``.

    Returns
    -------
    str
        Assistant response content.
    """

    if model not in MODEL_CONFIG:
        raise ValueError(f"Unknown model '{model}'. Available: {', '.join(MODEL_CONFIG)}")

    cfg = MODEL_CONFIG[model]
    api_key = os.getenv(cfg["api_key_env"])  # type: ignore[arg-type]
    endpoint = os.getenv(cfg["endpoint_env"])  # type: ignore[arg-type]

    if not api_key or not endpoint:
        missing = [k for k, v in (("API key", api_key), ("endpoint", endpoint)) if not v]
        raise EnvironmentError(f"Missing {', '.join(missing)} for {model}. Check your .env file.")

    # ▸ For o‑series preview we must merge the *system* message into the first *user* message
    if cfg.get("merge_system_into_user"):
        merged: list[dict] = []
        for msg in messages:
            if msg["role"] == "system":
                if merged and merged[-1]["role"] == "user":
                    merged[-1]["content"] = msg["content"] + "\n\n" + merged[-1]["content"]
                else:
                    merged.append({"role": "user", "content": msg["content"]})
            else:
                merged.append(msg)
        messages = merged

    # Build payload --------------------------------------------------------
    data = {
        "messages": messages,
        cfg["payload_key"]: cfg["max_tokens"],
        "model": cfg["deployment"],  
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": api_key,
    }

    # Call Azure -----------------------------------------------------------
    try:
        resp = requests.post(endpoint, headers=headers, json=data, timeout=60)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except requests.RequestException as exc:
        raise RuntimeError(f"Azure OpenAI error {resp.status_code if 'resp' in locals() else '?'}: {exc}") from exc
