from __future__ import annotations

import os
import subprocess
import sys
import time

from sqlalchemy import create_engine, text


def env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def wait_for_database() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required before starting the backend container.")

    max_attempts = int(os.getenv("DB_STARTUP_MAX_ATTEMPTS", "30"))
    sleep_seconds = float(os.getenv("DB_STARTUP_SLEEP_SECONDS", "2"))
    engine = create_engine(database_url, future=True, pool_pre_ping=True)

    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("Database is ready.", flush=True)
            return
        except Exception as error:
            print(
                f"Database not ready yet (attempt {attempt}/{max_attempts}): {error}",
                flush=True,
            )
            if attempt == max_attempts:
                raise
            time.sleep(sleep_seconds)


def run_step(command: list[str], label: str) -> None:
    print(f"Running {label}...", flush=True)
    subprocess.run(command, check=True)


def main() -> None:
    wait_for_database()

    if env_flag("RUN_DB_MIGRATIONS", True):
        run_step(["alembic", "upgrade", "head"], "database migrations")

    if env_flag("RUN_DB_SEED", True):
        run_step([sys.executable, "-m", "app.scripts.seed"], "database seed")

    print("Starting backend server...", flush=True)
    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
