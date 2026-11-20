"""REST service:  CKPT=runs/osga/best.pt uvicorn app.api:app --host 0.0.0.0 --port 8000
   curl -F file=@hand.png -F sex=male http://localhost:8000/predict"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import cv2, numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from osga.predictor import BoneAgePredictor

app = FastAPI(title="OSGA-Net Bone Age API (research prototype)")
_pred = None


def get_pred():
    global _pred
    if _pred is None:
        ck = os.environ.get("CKPT", "runs/osga/best.pt")
        if not os.path.exists(ck):
            raise HTTPException(503, f"checkpoint not found: {ck} (set CKPT)")
        _pred = BoneAgePredictor(ck)
    return _pred


@app.get("/health")
def health():
    return {"status": "ok", "checkpoint_loaded": _pred is not None}


@app.post("/predict")
async def predict(file: UploadFile = File(...), sex: str = Form(...), chron_months: float | None = Form(None)):
    if sex.lower() not in ("male", "female", "m", "f"):
        raise HTTPException(422, "sex must be male|female")
    im = cv2.imdecode(np.frombuffer(await file.read(), np.uint8), cv2.IMREAD_GRAYSCALE)
    if im is None:
        raise HTTPException(422, "could not decode image")
    r = get_pred().predict(im, sex.lower().startswith("m"), chron_months)
    r.pop("overlay", None); r.pop("distribution", None)
    return r
