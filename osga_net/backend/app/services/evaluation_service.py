from __future__ import annotations
import os
import json
from pathlib import Path
from typing import Any

from ..core.config import settings

TABLE_V = [
    ("Full OSGA-Net", "osga_full"),
    ("− GAT", "no_gat"),
    ("− FiLM", "no_film"),
    ("− Ordinal head", "no_ordinal"),
    ("− Landmark head", "no_landmark"),
]

BASELINES = [
    ("ResNet-18 (image only)", "base_resnet18"),
    ("EffNetV2-S + concatenation", "base_effnet_concat"),
    ("EffNetV2-S + cross-attention", "base_effnet_xattn"),
]

LITERATURE_SEEDS = [
    {
        "method": "BoNet (deformation-layer CNN)",
        "year": 2017,
        "mae": 9.60,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Spampinato et al., Neurocomputing 2017 [18]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Early deep learning baseline on RSNA challenge images."
    },
    {
        "method": "ResNet-50",
        "year": 2018,
        "mae": 6.24,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Larson et al., Radiology 2018 [17]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Standard clinical benchmark establishing CNN feasibility on pediatric hand radiographs."
    },
    {
        "method": "Two-stage deep network",
        "year": 2018,
        "mae": 5.98,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Chu et al., IEEE JBHI 2018 [10]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Two-stage framework focusing on isolated ossification patches."
    },
    {
        "method": "16Bit Inception-V3 (RSNA winner)",
        "year": 2018,
        "mae": 4.27,
        "mad": 4.27,
        "metric_name": "MAD (mo.)",
        "reference": "Halabi et al., Radiology 2018 [16]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Official winning single model of 2017 RSNA challenge (internal test set)."
    },
    {
        "method": "Cascaded critical-region CNN",
        "year": 2023,
        "mae": 5.45,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Liu et al., BJR 2023 [6]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Critical region extraction using cascaded convolutional networks."
    },
    {
        "method": "Two-stage YOLOv5 + Swin Transformer",
        "year": 2023,
        "mae": 4.59,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Mao et al., Med Phys 2023 [3]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Object detection for region extraction combined with Swin Transformer."
    },
    {
        "method": "Concatenation-fusion EfficientNetV2-S",
        "year": 2024,
        "mae": 4.92,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Kim et al., Sci Rep 2024 [1]",
        "is_proposed_model": False,
        "status": "published",
        "note": "Direct concatenation of image embeddings with sex metadata (0.410 years)."
    },
    {
        "method": "Two-stream global-local fusion",
        "year": 2025,
        "mae": 3.81,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "Lou et al., IEEE TMI 2025 [22]",
        "is_proposed_model": False,
        "status": "published",
        "note": "State-of-the-art dual-branch global hand and local patch fusion."
    },
    {
        "method": "OSGA-Net (Proposed)",
        "year": 2026,
        "mae": None,
        "mad": None,
        "metric_name": "MAE (mo.)",
        "reference": "This Work (Structure-Aware Graph Attention)",
        "is_proposed_model": True,
        "status": "pending_evaluation",
        "note": "Evaluation pending — no verified comparable result. Will be populated once evaluate.py is run."
    }
]


class EvaluationService:
    def __init__(self, runs_dir: str = settings.RUNS_DIR, results_json: str = settings.RESULTS_JSON):
        self.runs_dir = Path(runs_dir)
        self.results_json_path = Path(results_json)

    def get_evaluation(self, split: str = "val") -> dict[str, Any]:
        target_dir = self.runs_dir / "osga"
        metrics_file = target_dir / f"metrics_{split}.json"
        
        # Also check osga_full
        if not metrics_file.exists():
            metrics_file = self.runs_dir / "osga_full" / f"metrics_{split}.json"

        if not metrics_file.exists():
            return {
                "available": False,
                "split": split,
                "overall": None,
                "stratified": None,
                "calibration": None,
                "predictions_count": 0,
                "note": "Evaluation not run. Train models with train.py or ablation.py and evaluate with evaluate.py to produce metrics."
            }

        try:
            with open(metrics_file, "r") as f:
                data = json.load(f)
            return {
                "available": True,
                "split": split,
                "overall": data.get("overall"),
                "stratified": data.get("stratified"),
                "calibration": data.get("calibration"),
                "predictions_count": data.get("overall", {}).get("n", 0),
                "note": f"Real evaluation metrics loaded from {metrics_file.name}."
            }
        except Exception as e:
            return {
                "available": False,
                "split": split,
                "overall": None,
                "stratified": None,
                "calibration": None,
                "predictions_count": 0,
                "note": f"Error reading evaluation metrics: {str(e)}"
            }

    def get_ablations(self, split: str = "val") -> dict[str, Any]:
        full_mae = None
        # Check if full model exists
        full_path = self.runs_dir / "osga_full" / f"metrics_{split}.json"
        if not full_path.exists():
            full_path = self.runs_dir / "osga" / f"metrics_{split}.json"
        if full_path.exists():
            try:
                with open(full_path) as f:
                    full_mae = json.load(f).get("overall", {}).get("mae")
            except Exception:
                pass

        def parse_row(label: str, dir_name: str) -> dict[str, Any]:
            p = self.runs_dir / dir_name / f"metrics_{split}.json"
            if not p.exists():
                return {
                    "label": label,
                    "key": dir_name,
                    "status": "not_run",
                    "mae": None,
                    "rmse": None,
                    "acc6": None,
                    "acc12": None,
                    "n": None,
                    "ci95": None,
                    "pct_change_vs_full": None,
                }
            try:
                with open(p) as f:
                    d = json.load(f)
                ov = d.get("overall", {})
                mae = ov.get("mae")
                pct = round(((mae - full_mae) / full_mae) * 100.0, 2) if (mae and full_mae) else None
                return {
                    "label": label,
                    "key": dir_name,
                    "status": "completed",
                    "mae": mae,
                    "rmse": ov.get("rmse"),
                    "acc6": ov.get("acc_6mo"),
                    "acc12": ov.get("acc_12mo"),
                    "n": ov.get("n"),
                    "ci95": ov.get("mae_ci95"),
                    "pct_change_vs_full": pct,
                }
            except Exception:
                return {
                    "label": label,
                    "key": dir_name,
                    "status": "not_run",
                    "mae": None,
                    "rmse": None,
                    "acc6": None,
                    "acc12": None,
                    "n": None,
                    "ci95": None,
                    "pct_change_vs_full": None,
                }

        ablations = [parse_row(label, dirname) for label, dirname in TABLE_V]
        baselines = [parse_row(label, dirname) for label, dirname in BASELINES]
        any_done = any(r["status"] == "completed" for r in ablations + baselines)

        return {
            "available": any_done,
            "split": split,
            "ablations": ablations,
            "baselines": baselines,
            "note": "Ablation study (Table V). Un-run variants display as Not Run / Pending."
        }

    def get_literature(self) -> dict[str, Any]:
        # Check if full OSGA-Net has a real MAE to update the proposed row
        eval_data = self.get_evaluation("val")
        entries = [dict(e) for e in LITERATURE_SEEDS]
        if eval_data["available"] and eval_data.get("overall", {}).get("mae") is not None:
            val_mae = eval_data["overall"]["mae"]
            for e in entries:
                if e["is_proposed_model"]:
                    e["mae"] = round(float(val_mae), 2)
                    e["status"] = "evaluated"
                    e["note"] = f"Real evaluation result: MAE {val_mae:.2f} months on validation split."

        return {
            "entries": entries,
            "disclaimer": "Published literature figures were measured under differing institutional protocols and test sets; direct head-to-head comparison is not implied."
        }


evaluation_service = EvaluationService()
