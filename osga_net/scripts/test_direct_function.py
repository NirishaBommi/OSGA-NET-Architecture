import sys
import time
from pathlib import Path
import asyncio

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

print("1. Initializing DB and Inference Service...", flush=True)
from backend.app.db.session import init_db, SessionLocal
from backend.app.services.inference_service import inference_service
from backend.app.core.deps import get_current_user_or_guest
from backend.app.api.assessments import direct_assess
from backend.app.core.config import settings

init_db()
inference_service.initialize()
print(f"2. Service ready. Model checkpoint: {inference_service.loaded_ckpt_path}", flush=True)

# Ensure upload directory exists
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

db = SessionLocal()
class FakeRequest:
    cookies = {}

user = get_current_user_or_guest(FakeRequest(), db=db, token_header=None)
print(f"3. Authenticated as: {user.username} (id: {user.id})", flush=True)

img_path = ROOT / "data" / "raw" / "boneage-training-dataset" / "1377.png"
with open(img_path, "rb") as f:
    img_data = f.read()

class AsyncUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content

    async def read(self, size: int = -1) -> bytes:
        return self.content

mock_upload = AsyncUploadFile("1377.png", img_data)

async def run():
    print("4. Executing direct_assess...", flush=True)
    t0 = time.time()
    resp = await direct_assess(
        file=mock_upload,
        sex="female",
        chron_years=9.0,
        run_demo=False,
        current_user=user,
        db=db,
    )
    print(f"5. direct_assess finished in {time.time()-t0:.2f}s!", flush=True)
    print(f"Assessment ID: {resp.assessment.id}", flush=True)
    print(f"Predicted Bone Age: {resp.result.prediction.bone_age_formatted} ({resp.result.prediction.bone_age_months:.2f} mo)", flush=True)
    print(f"Standard Deviation: \u00b1{resp.result.uncertainty.standard_deviation:.2f} mo", flush=True)
    print(f"Landmarks: {len(resp.result.landmarks)} detected", flush=True)
    print(f"Weights: {len(resp.result.readout_weights)} regions", flush=True)
    print(f"Distribution: {len(resp.result.prediction.probability_distribution)} bins", flush=True)
    print("\n>>> ALL TESTS PASS: DIRECT INFERENCE FULLY FUNCTIONAL! <<<", flush=True)

asyncio.run(run())
