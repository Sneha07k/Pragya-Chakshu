import os
from pathlib import Path

# Base project directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Dynamic dataset path resolution:
# 1. Custom environment variable (if set and valid)
# 2. Full research dataset (dataset/data-and-readme)
# 3. Lightweight curated sample dataset (dataset/sample)
_env_path = os.getenv("DATASET_BASE_PATH")
if _env_path and os.path.exists(_env_path):
    DATASET_BASE_PATH = _env_path
elif (BASE_DIR / "dataset" / "data-and-readme").exists():
    DATASET_BASE_PATH = str(BASE_DIR / "dataset" / "data-and-readme")
else:
    DATASET_BASE_PATH = str(BASE_DIR / "dataset" / "sample")

SQLITE_DB_PATH = os.getenv(
    "SQLITE_DB_PATH", str(BASE_DIR / "backend" / "data" / "pragya_chakshu.db")
)
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "pragya_chakshu")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
