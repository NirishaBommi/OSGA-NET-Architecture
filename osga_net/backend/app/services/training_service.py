"""Training manager service for background two-stage OSGA-Net training."""
from __future__ import annotations
import os
import sys
import json
import time
import math
import random
import threading
import logging
from pathlib import Path
from typing import Any, Callable
import torch
import numpy as np
import pandas as pd
from torch.utils.data import DataLoader

from ..core.config import settings
from osga.dataset import BoneAgeDataset
from osga.model import build_model
from osga.losses import total_loss
from osga.engine import to_device, forward, predict_loader
from osga import metrics

logger = logging.getLogger("training_service")


def cosine_lr(base: float, t: int, T: int, warm: int = 0) -> float:
    if t < warm:
        return base * (t + 1) / (warm + 1)
    return base * 0.5 * (1 + math.cos(math.pi * (t - warm) / max(1, T - warm)))


class TrainingManager:
    _instance: TrainingManager | None = None

    def __init__(self, out_dir: str | Path | None = None):
        self.out_dir = Path(out_dir) if out_dir else Path(settings.RUNS_DIR) / "osga"
        self.out_dir.mkdir(parents=True, exist_ok=True)
        
        self.status = "idle"  # idle, running_stage1, running_stage2, paused, stopped, completed, error
        self.current_stage = 0
        self.current_epoch = 0
        self.total_epochs = 0
        self.current_batch = 0
        self.total_batches = 0
        self.best_mae: float = float("inf")
        self.history: list[dict[str, Any]] = []
        self.error_message: str | None = None
        
        self._thread: threading.Thread | None = None
        self._pause_requested = threading.Event()
        self._stop_requested = threading.Event()
        self._subscribers: list[Callable[[dict[str, Any]], None]] = []
        
        # Load existing history if available
        hist_file = self.out_dir / "history.json"
        if hist_file.is_file():
            try:
                with open(hist_file, "r") as f:
                    self.history = json.load(f)
                    if self.history:
                        maes = [h["val_mae"] for h in self.history if "val_mae" in h]
                        if maes:
                            self.best_mae = min(maes)
            except Exception:
                pass

    @classmethod
    def get_instance(cls) -> TrainingManager:
        if cls._instance is None:
            cls._instance = TrainingManager()
        return cls._instance

    def subscribe(self, callback: Callable[[dict[str, Any]], None]):
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[dict[str, Any]], None]):
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def broadcast(self, message: dict[str, Any]):
        for cb in list(self._subscribers):
            try:
                cb(message)
            except Exception:
                pass

    def get_status(self) -> dict[str, Any]:
        last_metric = self.history[-1] if self.history else {}
        return {
            "status": self.status,
            "stage": self.current_stage,
            "epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "batch": self.current_batch,
            "total_batches": self.total_batches,
            "best_mae": self.best_mae if self.best_mae != float("inf") else None,
            "last_train_loss": last_metric.get("train_loss"),
            "last_val_loss": last_metric.get("val_loss"),
            "last_val_mae": last_metric.get("val_mae"),
            "last_val_rmse": last_metric.get("val_rmse"),
            "learning_rate": last_metric.get("lr"),
            "error_message": self.error_message,
            "completed_epochs": len(self.history),
            "device": "cuda" if torch.cuda.is_available() else "cpu",
        }

    def get_history(self) -> list[dict[str, Any]]:
        return self.history

    def get_checkpoints(self) -> list[dict[str, Any]]:
        ckpts = []
        for name in ["best.pt", "last.pt", "stage1_best.pt"]:
            p = self.out_dir / name
            if p.is_file():
                info = {
                    "name": name,
                    "path": str(p),
                    "size_bytes": p.stat().st_size,
                    "last_modified": p.stat().st_mtime,
                }
                try:
                    data = torch.load(str(p), map_location="cpu", weights_only=False)
                    info["epoch"] = data.get("epoch")
                    info["val_mae"] = data.get("val_mae")
                    info["model_name"] = data.get("model_name", "osga")
                except Exception:
                    pass
                ckpts.append(info)
        return ckpts

    def start_training(
        self,
        splits_path: str | Path | None = None,
        img_size: int = 384,
        batch_size: int = 4,
        epochs1: int = 5,
        epochs2: int = 15,
        lr: float = 3e-4,
        backbone_lr_mult: float = 0.1,
        weight_decay: float = 1e-4,
        lam: float = 0.3,
        sigma: float = 6.0,
        patience: int = 10,
        resume: bool = False,
    ) -> dict[str, Any]:
        if self.status in ("running_stage1", "running_stage2"):
            return {"status": "error", "message": "Training is already in progress"}

        self._pause_requested.clear()
        self._stop_requested.clear()
        self.error_message = None

        splits = Path(splits_path) if splits_path else settings.SPLITS_CSV
        if not splits.is_file():
            splits = Path("data/splits.csv")
        if not splits.is_file():
            return {"status": "error", "message": f"Splits file not found at {splits}"}

        cfg = {
            "splits": str(splits),
            "out": str(self.out_dir),
            "img_size": img_size,
            "batch_size": batch_size,
            "epochs1": epochs1,
            "epochs2": epochs2,
            "lr": lr,
            "backbone_lr_mult": backbone_lr_mult,
            "weight_decay": weight_decay,
            "lam": lam,
            "sigma": sigma,
            "patience": patience,
            "resume": resume,
        }

        self._thread = threading.Thread(target=self._run_training_loop, args=(cfg,), daemon=True)
        self._thread.start()
        return {"status": "started", "config": cfg}

    def pause_training(self) -> dict[str, Any]:
        if self.status not in ("running_stage1", "running_stage2"):
            return {"status": "error", "message": "No active training run to pause"}
        self._pause_requested.set()
        return {"status": "pause_requested"}

    def resume_training(self) -> dict[str, Any]:
        if self.status != "paused":
            return {"status": "error", "message": "Training is not paused"}
        last_ckpt = self.out_dir / "last.pt"
        if not last_ckpt.is_file():
            return {"status": "error", "message": "No checkpoint (last.pt) found to resume from"}
        return self.start_training(resume=True)

    def stop_training(self) -> dict[str, Any]:
        if self.status not in ("running_stage1", "running_stage2", "paused"):
            return {"status": "error", "message": "No active training to stop"}
        self._stop_requested.set()
        return {"status": "stop_requested"}

    def _run_training_loop(self, cfg: dict[str, Any]):
        dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        try:
            df = pd.read_csv(cfg["splits"])
            trn = df[df.split == "train"]
            val = df[df.split == "val"]

            kw = dict(img_size=cfg["img_size"], landmark_source="template", landmark_csv=None)
            tl = DataLoader(BoneAgeDataset(trn, train=True, **kw), cfg["batch_size"], shuffle=True)
            vl = DataLoader(BoneAgeDataset(val, train=False, **kw), cfg["batch_size"], shuffle=False)

            mkw = dict(pretrained=False, use_landmark=True, use_film=True, use_gat=True, ordinal=True, use_chron=False)
            model = build_model("osga", **mkw).to(dev)

            e1 = cfg["epochs1"]
            E = e1 + cfg["epochs2"]
            self.total_epochs = E

            groups = [
                {"params": model.backbone_params(), "base_lr": cfg["lr"] * cfg["backbone_lr_mult"]},
                {"params": model.other_params(), "base_lr": cfg["lr"]},
            ]
            opt = torch.optim.AdamW(groups, lr=cfg["lr"], weight_decay=cfg["weight_decay"])

            st = {"epoch": 0, "best_mae": float("inf"), "bad": 0, "history": []}
            last_ckpt = self.out_dir / "last.pt"
            best_ckpt = self.out_dir / "best.pt"

            if cfg["resume"] and last_ckpt.is_file():
                ck = torch.load(last_ckpt, map_location=dev, weights_only=False)
                model.load_state_dict(ck["model"])
                opt.load_state_dict(ck["opt"])
                st = ck["state"]
                self.history = st.get("history", [])
                self.best_mae = st.get("best_mae", float("inf"))

            for ep in range(st["epoch"], E):
                if self._stop_requested.is_set():
                    self.status = "stopped"
                    self.broadcast({"type": "status_change", "status": "stopped"})
                    break

                if self._pause_requested.is_set():
                    self.status = "paused"
                    self.broadcast({"type": "status_change", "status": "paused"})
                    break

                stage = 1 if ep < e1 else 2
                self.current_stage = stage
                self.current_epoch = ep + 1
                self.status = f"running_stage{stage}"

                T, t = (e1, ep) if stage == 1 else (cfg["epochs2"], ep - e1)
                for g in opt.param_groups:
                    g["lr"] = cosine_lr(g["base_lr"], t, T, warm=1 if stage == 2 else 0)

                t0 = time.time()
                model.train()
                run_loss, run_heatmap, run_kl, n_samples = 0.0, 0.0, 0.0, 0
                self.total_batches = len(tl)

                for bidx, b in enumerate(tl):
                    if self._stop_requested.is_set():
                        break
                    self.current_batch = bidx + 1
                    b = to_device(b, dev)
                    out = forward(model, b)
                    loss, parts = total_loss(out, b, model, cfg["lam"], cfg["sigma"], stage)

                    opt.zero_grad()
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                    opt.step()

                    bs = len(b["id"])
                    run_loss += loss.item() * bs
                    run_heatmap += parts.get("heat_mse", 0.0) * bs
                    run_kl += parts.get("kl", 0.0) * bs
                    n_samples += bs

                    if (bidx + 1) % max(1, len(tl) // 4) == 0 or (bidx + 1) == len(tl):
                        self.broadcast({
                            "type": "batch_progress",
                            "epoch": ep + 1,
                            "stage": stage,
                            "batch": bidx + 1,
                            "total_batches": len(tl),
                            "loss": round(loss.item(), 4),
                        })

                avg_train_loss = run_loss / max(1, n_samples)
                avg_heatmap_mse = run_heatmap / max(1, n_samples)
                avg_kl = run_kl / max(1, n_samples)

                rec: dict[str, Any] = {
                    "epoch": ep + 1,
                    "stage": stage,
                    "train_loss": round(avg_train_loss, 4),
                    "heatmap_mse": round(avg_heatmap_mse, 4),
                    "kl_loss": round(avg_kl, 4),
                    "lr": round(opt.param_groups[1]["lr"], 6),
                    "duration_sec": round(time.time() - t0, 1),
                }

                if stage == 1:
                    # Save stage1 best checkpoint
                    torch.save({
                        "model": model.state_dict(),
                        "model_name": "osga",
                        "model_kwargs": mkw,
                        "img_size": cfg["img_size"],
                        "epoch": ep + 1,
                        "heatmap_mse": avg_heatmap_mse,
                    }, self.out_dir / "stage1_best.pt")

                if stage == 2 and len(vl) > 0:
                    model.eval()
                    pred_df = predict_loader(model, vl, dev, amp=False)
                    m = metrics.basic(pred_df.true, pred_df.pred)
                    rec["val_mae"] = round(float(m["mae"]), 2)
                    rec["val_rmse"] = round(float(m["rmse"]), 2)

                    if m["mae"] < st["best_mae"]:
                        st["best_mae"] = m["mae"]
                        st["bad"] = 0
                        self.best_mae = m["mae"]
                        torch.save({
                            "model": model.state_dict(),
                            "model_name": "osga",
                            "model_kwargs": {**mkw, "pretrained": False},
                            "img_size": cfg["img_size"],
                            "epoch": ep + 1,
                            "val_mae": m["mae"],
                            "val_rmse": m["rmse"],
                        }, best_ckpt)
                    else:
                        st["bad"] += 1

                self.history.append(rec)
                st["history"] = self.history
                st["epoch"] = ep + 1

                # Save latest checkpoint
                torch.save({
                    "model": model.state_dict(),
                    "opt": opt.state_dict(),
                    "state": st,
                }, last_ckpt)

                # Persist history JSON
                with open(self.out_dir / "history.json", "w") as hf:
                    json.dump(self.history, hf, indent=2)

                self.broadcast({"type": "epoch_end", "metric": rec, "summary": self.get_status()})

                if stage == 2 and st["bad"] >= cfg["patience"]:
                    logger.info("Early stopping triggered at epoch %d", ep + 1)
                    break

            if not self._pause_requested.is_set() and not self._stop_requested.is_set():
                self.status = "completed"
                self.broadcast({"type": "status_change", "status": "completed"})
                # Reload predictor in inference service with the newly trained best.pt
                if best_ckpt.is_file():
                    from .inference_service import inference_service
                    inference_service.reload(str(best_ckpt))

        except Exception as e:
            logger.exception("Error in training loop: %s", str(e))
            self.status = "error"
            self.error_message = str(e)
            self.broadcast({"type": "error", "message": str(e)})


training_manager = TrainingManager.get_instance()
