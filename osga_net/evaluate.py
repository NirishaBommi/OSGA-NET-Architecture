"""Evaluate a trained checkpoint on a split and write predictions + metrics.
  python evaluate.py --ckpt runs/osga/best.pt --splits data/splits.csv --split test
"""
import argparse, json, os
import numpy as np, pandas as pd, torch
from torch.utils.data import DataLoader
from osga.dataset import BoneAgeDataset
from osga.model import build_model
from osga.engine import predict_loader
from osga import metrics

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", required=True); ap.add_argument("--splits", required=True)
ap.add_argument("--split", default="val", choices=["val", "test", "train"])
ap.add_argument("--fold", type=int, default=-1); ap.add_argument("--batch_size", type=int, default=32)
ap.add_argument("--workers", type=int, default=2); ap.add_argument("--max_samples", type=int, default=0)
a = ap.parse_args()

dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ck = torch.load(a.ckpt, map_location=dev, weights_only=False)
model = build_model(ck["model_name"], **ck["model_kwargs"]).to(dev)
model.load_state_dict(ck["model"])
df = pd.read_csv(a.splits)
df = df[(df.split == "train") & (df.fold == a.fold)] if a.fold >= 0 else df[df.split == a.split]
if a.max_samples: df = df.head(a.max_samples)
if df.empty: raise SystemExit(f"no rows for split={a.split}")
dl = DataLoader(BoneAgeDataset(df, img_size=ck["img_size"], train=False, landmark_source="none"), a.batch_size, num_workers=a.workers)
pred = predict_loader(model, dl, dev)
out = os.path.dirname(os.path.abspath(a.ckpt)); tag = f"fold{a.fold}" if a.fold >= 0 else a.split
pred.to_csv(os.path.join(out, f"preds_{tag}.csv"), index=False)
rep = metrics.full_report(pred)
metrics.save_json(rep, os.path.join(out, f"metrics_{tag}.json"))
if a.split == "val" and (pred["std"] > 0).any():
    metrics.save_json({"uncertainty_threshold_p90": float(pred["std"].quantile(0.9))}, os.path.join(out, "calibration.json"))
print(json.dumps(rep, indent=2))
