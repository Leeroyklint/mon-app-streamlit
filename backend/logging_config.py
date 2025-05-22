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

for name in (
    "azure.core.pipeline.policies.http_logging_policy",  # request/response
    "azure.cosmos",                                     # au cas où
):
    logging.getLogger(name).setLevel(logging.WARNING)   # ou ERROR/CRITICAL

