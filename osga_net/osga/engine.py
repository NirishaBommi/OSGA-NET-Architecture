"""Shared train/eval loop helpers."""
from __future__ import annotations
import numpy as np
import pandas as pd
import torch


def to_device(batch, dev):
    return {k: (v.to(dev, non_blocking=True) if torch.is_tensor(v) else v) for k, v in batch.items()}


def forward(model, b):
    return model(b["img"], b["male"], b["chron"], b["chron_mask"])


@torch.no_grad()
def predict_loader(model, loader, dev, amp=False):
    model.eval()
    rows = []
    for b in loader:
        b = to_device(b, dev)
        with torch.autocast(device_type=dev.type, enabled=amp and dev.type == "cuda"):
            o = forward(model, b)
        for i in range(len(b["id"])):
            rows.append({"id": b["id"][i], "true": float(b["age"][i]), "pred": float(o["pred"][i]),
                         "std": float(o["std"][i]), "male": int(b["male"][i])})
    return pd.DataFrame(rows)
