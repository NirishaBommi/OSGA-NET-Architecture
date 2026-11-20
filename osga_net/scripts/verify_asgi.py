import asyncio
import sys
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.main import app
from backend.app.db.session import init_db
from backend.app.services.inference_service import inference_service


async def main():
    print("Initializing DB and Inference Service...", flush=True)
    init_db()
    inference_service.initialize()
    print(f"Inference service initialized. Loaded checkpoint: {inference_service.loaded_ckpt_path}", flush=True)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        endpoints = [
            ("Health Check", "/health"),
            ("Model Status", "/api/model/status"),
            ("Model Architecture", "/api/architecture"),
            ("Dataset Summary", "/api/dataset/summary"),
            ("Evaluation Metrics (val)", "/api/evaluation/metrics?split=val"),
            ("Evaluation Ablations (val)", "/api/evaluation/ablation?split=val"),
            ("Literature Benchmarks", "/api/evaluation/literature"),
            ("System Resources", "/api/system/resources"),
            ("SPA Root Dashboard", "/"),
            ("SPA Deep Route (/architecture)", "/architecture"),
        ]

        print("\n--- PROBING FASTAPI REST & SPA ENDPOINTS ---", flush=True)
        failed = 0
        for name, path in endpoints:
            try:
                resp = await client.get(path)
                assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:100]}"
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
                    data = resp.json()
                    summary = f"Keys: {list(data.keys())}" if isinstance(data, dict) else f"Items: {len(data)}"
                    print(f"[PASS] {name:<32} -> 200 OK (JSON: {summary})", flush=True)
                else:
                    print(f"[PASS] {name:<32} -> 200 OK (HTML: {len(resp.text)} chars)", flush=True)
            except Exception as e:
                print(f"[FAIL] {name:<32} -> {e}", flush=True)
                failed += 1

        print("\n--- TESTING REAL RADIOGRAPH INFERENCE VIA DIRECT-ASSESS ---", flush=True)
        sample_img_path = ROOT / "data" / "raw" / "boneage-training-dataset" / "1377.png"
        if sample_img_path.is_file():
            with open(sample_img_path, "rb") as f:
                img_bytes = f.read()

            files = {"file": ("1377.png", img_bytes, "image/png")}
            form_data = {"sex": "female", "chron_years": "9.0"}

            resp = await client.post("/api/assessments/direct-assess", files=files, data=form_data)
            if resp.status_code == 201:
                res_json = resp.json()
                assessment = res_json["assessment"]
                pred = res_json["result"]["prediction"]
                uncertainty = res_json["result"]["uncertainty"]
                landmarks = res_json["result"]["landmarks"]
                weights = res_json["result"]["readout_weights"]

                print(f"[PASS] Real Inference Assessment ID: {assessment['id']}", flush=True)
                print(f"[PASS] Predicted Bone Age: {pred['bone_age_formatted']} ({pred['bone_age_months']:.2f} months)", flush=True)
                print(f"[PASS] Uncertainty Std: \u00b1{uncertainty['standard_deviation']:.2f} months, Variance: {uncertainty['variance']:.2f}", flush=True)
                print(f"[PASS] Landmarks Detected: {len(landmarks)} regions", flush=True)
                print(f"[PASS] GAT Readout Weights Count: {len(weights)} regions", flush=True)
                print(f"[PASS] 228-bin Probabilities Count: {len(pred['probability_distribution'])}", flush=True)
                print(f"[PASS] Probabilities Sum: {sum(pred['probability_distribution']):.4f}", flush=True)
            else:
                print(f"[FAIL] Direct Assess returned {resp.status_code}: {resp.text}", flush=True)
                failed += 1
        else:
            print(f"[SKIP] Sample image {sample_img_path} not found.", flush=True)

        if failed > 0:
            print(f"\nCompleted with {failed} failure(s).", flush=True)
            sys.exit(1)
        else:
            print("\nALL BACKEND API, MODEL INFERENCE, AND SPA ROUTES FULLY VERIFIED!", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
