# logging_config.py
import logging, sys, os, json
LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
datefmt = "%Y-%m-%dT%H:%M:%S"

logging.basicConfig(
    level=LEVEL,
    format=fmt,
    datefmt=datefmt,
    stream=sys.stdout,
)

def json_dumps(obj):
    try:
        return json.dumps(obj, default=str)             # évite les objets non‑sérialisables
    except Exception:
        return str(obj)
