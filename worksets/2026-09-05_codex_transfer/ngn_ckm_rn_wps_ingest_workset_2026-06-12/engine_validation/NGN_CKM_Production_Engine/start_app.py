"""Local app launcher. Opens the browser UI and starts FastAPI."""
from __future__ import annotations

import os
import threading
import webbrowser
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent


def open_browser():
    webbrowser.open("http://127.0.0.1:8000")


if __name__ == "__main__":
    os.chdir(ROOT)
    (ROOT / "output").mkdir(exist_ok=True)
    (ROOT / "logs").mkdir(exist_ok=True)
    threading.Timer(1.5, open_browser).start()
    uvicorn.run("backend.main_app:app", host="127.0.0.1", port=8000, reload=False)
