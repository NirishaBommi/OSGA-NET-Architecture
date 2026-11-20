"""PLUMBING ONLY - random tensors / noise images. Verifies shapes, gradients, CLI wiring.
These produce NO scientific results. Run:  python tests/smoke_test.py"""
import os, sys, subprocess, tempfile, shutil, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, cv2, pandas as pd, torch
from osga.model import build_model, OSGANet
from osga.landmarks import build_adjacency, NUM_NODES
from osga.losses import total_loss

def unit():
    A = build_adjacency(); assert A.shape == (13, 13) and (A == A.T).all() and A.diagonal().all()
    B, S = 2, 192
    img, male = torch.randn(B, 3, S, S), torch.tensor([0., 1.])
    for kw in [{}, {"use_gat": False}, {"use_film": False}, {"ordinal": False}, {"use_landmark": False}]:
        m = build_model("osga", pretrained=False, **kw); m.train()
        o = m(img, male, torch.zeros(B), torch.zeros(B))
        batch = {"age": torch.tensor([60., 150.]), "heat": torch.rand(B, 13, S // 8, S // 8), "heat_valid": torch.ones(B, 13)}
        loss, _ = total_loss(o, batch, m); loss.backward()
        assert o["pred"].shape == (B,) and torch.isfinite(loss), kw
        if m.ordinal: assert o["probs"].shape == (B, 228) and abs(o["probs"].sum(1).mean().item() - 1) < 1e-4
        gnull = [n for n, p in m.named_parameters() if p.requires_grad and p.grad is None]
        print("osga", kw or "full", "ok; params w/o grad:", gnull[:3])
    for n in ["resnet18", "effnet_concat", "effnet_xattn"]:
        m = build_model(n, pretrained=False); o = m(img, male); o["pred"].sum().backward(); print(n, "ok")

def cli():
    d = tempfile.mkdtemp(); rng = np.random.default_rng(0); rows = []
    os.makedirs(f"{d}/img")
    for i in range(12):
        im = np.zeros((300, 260), np.uint8); cv2.ellipse(im, (130, 150), (70, 110), 0, 0, 360, int(rng.integers(120, 220)), -1)
        im = (im + rng.integers(0, 30, im.shape)).astype(np.uint8); cv2.imwrite(f"{d}/img/{i}.png", im)
        rows.append({"id": i, "boneage": int(rng.integers(12, 220)), "male": bool(i % 2)})
    pd.DataFrame(rows).to_csv(f"{d}/lab.csv", index=False)
    py = sys.executable; root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    run = lambda *a: subprocess.run([py, *a], check=True, cwd=root)
    run("scripts/prepare_data.py", "--img_dir", f"{d}/img", "--csv", f"{d}/lab.csv", "--out", f"{d}/splits.csv", "--folds", "2", "--val_frac", "0.25")
    common = ["--splits", f"{d}/splits.csv", "--img_size", "192", "--batch_size", "4", "--no_pretrained", "--workers", "0"]
    run("train.py", *common, "--out", f"{d}/run", "--epochs1", "1", "--epochs2", "2")
    run("train.py", *common, "--out", f"{d}/run", "--epochs1", "1", "--epochs2", "3", "--resume")   # resume path
    run("evaluate.py", "--ckpt", f"{d}/run/best.pt", "--splits", f"{d}/splits.csv", "--split", "val", "--workers", "0")
    run("train.py", *common, "--out", f"{d}/base", "--model", "resnet18", "--epochs2", "1")
    from osga.predictor import BoneAgePredictor
    p = BoneAgePredictor(f"{d}/run/best.pt", "cpu"); r = p.predict(cv2.imread(f"{d}/img/0.png", 0), True)
    print({k: v for k, v in r.items() if k in ("bone_age", "uncertainty_std_months", "needs_review")})
    os.environ["CKPT"] = f"{d}/run/best.pt"
    from fastapi.testclient import TestClient
    from app.api import app
    c = TestClient(app); assert c.get("/health").status_code == 200
    resp = c.post("/predict", files={"file": open(f"{d}/img/1.png", "rb")}, data={"sex": "female"}); assert resp.status_code == 200, resp.text
    print("api ok:", resp.json()["bone_age"])
    shutil.rmtree(d)

if __name__ == "__main__":
    unit(); cli(); print("ALL PLUMBING CHECKS PASSED (no scientific results implied)")
