import subprocess
import time
import urllib.request
import json
import sys
import os
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
venv_py = ROOT / ".venv" / "Scripts" / "python.exe"

print(f"Project ROOT: {ROOT}")
print(f"Using Python: {venv_py}")

env = dict(os.environ)
env["PYTHONPATH"] = str(ROOT)

proc = subprocess.Popen(
    [str(venv_py), "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=str(ROOT),
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)

def stream_logs():
    for line in iter(proc.stdout.readline, ''):
        print(f"[UVICORN] {line.strip()}", flush=True)

log_thread = threading.Thread(target=stream_logs, daemon=True)
log_thread.start()

endpoints = [
    "http://127.0.0.1:8000/health",
    "http://127.0.0.1:8000/api/model/status",
    "http://127.0.0.1:8000/api/architecture",
    "http://127.0.0.1:8000/api/dataset/summary",
    "http://127.0.0.1:8000/api/evaluation/metrics?split=val",
    "http://127.0.0.1:8000/api/evaluation/ablation?split=val",
    "http://127.0.0.1:8000/api/evaluation/literature",
    "http://127.0.0.1:8000/api/system/resources",
    "http://127.0.0.1:8000/",
    "http://127.0.0.1:8000/architecture",
]

success = False
print("Waiting for Uvicorn server to start...")
for attempt in range(60):
    time.sleep(1.0)
    if proc.poll() is not None:
        print(f"Uvicorn exited early with code {proc.returncode}!")
        break
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as resp:
            if resp.status == 200:
                print(f"\nServer healthy after {attempt * 1.0:.1f}s!")
                success = True
                break
    except Exception:
        continue

if not success:
    print("Server failed to respond within 60s")
    proc.terminate()
    sys.exit(1)

print("\n--- PROBING ENDPOINTS ---")
failed = 0
for url in endpoints:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
            if "json" in content_type:
                preview = json.loads(data.decode("utf-8"))
                keys = list(preview.keys()) if isinstance(preview, dict) else len(preview)
                print(f"SUCCESS [200] {url} -> JSON ({keys})")
            else:
                html_snippet = data.decode("utf-8")[:80].replace("\n", "")
                print(f"SUCCESS [200] {url} -> HTML ({len(data)} bytes: {html_snippet}...)")
    except Exception as e:
        print(f"FAILED {url} -> {e}")
        failed += 1

proc.terminate()
proc.wait()
print("\nServer cleanly terminated.")
if failed > 0:
    sys.exit(1)
print("All endpoints verified successfully!")
