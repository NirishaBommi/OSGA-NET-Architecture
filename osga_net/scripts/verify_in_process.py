import time
import urllib.request
import json
import sys
import threading
from pathlib import Path

# Set up paths
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

print("Loading FastAPI app and OSGA-Net model...")
from backend.app.main import app
import uvicorn

config = uvicorn.Config(app=app, host="127.0.0.1", port=8000, log_level="info", loop="asyncio")
server = uvicorn.Server(config=config)

server_thread = threading.Thread(target=server.run, daemon=True)
server_thread.start()

print("Waiting for server to become responsive...")
success = False
for attempt in range(40):
    time.sleep(1.0)
    if not server_thread.is_alive():
        print("Server thread died unexpectedly!")
        break
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                print(f"Server is healthy after {attempt * 1.0:.1f}s! Status: {data}")
                success = True
                break
    except Exception:
        continue

if not success:
    print("Server failed to respond within 40 seconds.")
    server.should_exit = True
    sys.exit(1)

endpoints = [
    ("Health Check", "http://127.0.0.1:8000/health"),
    ("Model Status", "http://127.0.0.1:8000/api/model/status"),
    ("Model Architecture", "http://127.0.0.1:8000/api/architecture"),
    ("Dataset Summary", "http://127.0.0.1:8000/api/dataset/summary"),
    ("Evaluation Metrics (val)", "http://127.0.0.1:8000/api/evaluation/metrics?split=val"),
    ("Evaluation Ablations (val)", "http://127.0.0.1:8000/api/evaluation/ablation?split=val"),
    ("Literature Benchmarks", "http://127.0.0.1:8000/api/evaluation/literature"),
    ("System Resources", "http://127.0.0.1:8000/api/system/resources"),
    ("SPA Root Dashboard", "http://127.0.0.1:8000/"),
    ("SPA Deep Route (/architecture)", "http://127.0.0.1:8000/architecture"),
]

print("\n--- PROBING ALL ENDPOINTS ---")
failed = 0
for name, url in endpoints:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            ct = resp.headers.get("Content-Type", "")
            content = resp.read()
            if "json" in ct:
                parsed = json.loads(content.decode("utf-8"))
                summary = f"Keys: {list(parsed.keys())}" if isinstance(parsed, dict) else f"Items: {len(parsed)}"
                print(f"[PASS] {name:<30} -> 200 OK (JSON, {summary})")
            else:
                print(f"[PASS] {name:<30} -> 200 OK (HTML, {len(content)} bytes)")
    except Exception as e:
        print(f"[FAIL] {name:<30} -> {e}")
        failed += 1

print("\nShutting down test server...")
server.should_exit = True
server_thread.join(timeout=5)
print("Server shut down cleanly.")

if failed > 0:
    print(f"FAILED: {failed} endpoints failed checks.")
    sys.exit(1)

print("\nALL SYSTEM & DASHBOARD API ENDPOINTS VERIFIED OPERATIONAL!")
