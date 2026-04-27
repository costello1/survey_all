from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_DB_PATH = ROOT_DIR / "backend" / "survey.db"
DEFAULT_STORAGE_DIR = ROOT_DIR / "storage" / "surveys"


def _load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Settings:
    admin_username: str
    admin_password: str
    secret_key: str
    frontend_origin: str
    public_app_url: str
    api_host: str
    api_port: int
    database_path: Path
    storage_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env = _load_env_file(ENV_PATH)

    return Settings(
        admin_username=env.get("ADMIN_USERNAME", "admin"),
        admin_password=env.get("ADMIN_PASSWORD", "admin1234!"),
        secret_key=env.get("SECRET_KEY", "prototype-survey-secret-key"),
        frontend_origin=env.get("FRONTEND_ORIGIN", "http://localhost:5173"),
        public_app_url=env.get("PUBLIC_APP_URL", "http://localhost:5173"),
        api_host=env.get("API_HOST", "127.0.0.1"),
        api_port=int(env.get("API_PORT", "8000")),
        database_path=DEFAULT_DB_PATH,
        storage_dir=DEFAULT_STORAGE_DIR,
    )
