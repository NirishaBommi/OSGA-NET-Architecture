from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Query
from ..core.config import settings
from ..services.evaluation_service import EvaluationService, TABLE_V, LITERATURE_SEEDS

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])
eval_service = EvaluationService()


@router.get("/metrics")
def get_evaluation_metrics(split: str = Query("val", description="'val' or 'test'")):
    """Returns actual evaluation metrics (MAE, RMSE, accuracy within 6m and 12m) for the requested split."""
    return eval_service.get_evaluation(split=split)


@router.get("/predictions")
def get_evaluation_predictions(split: str = Query("val", description="'val' or 'test'")):
    """Returns actual test or validation predictions (id, boneage, male, predicted, residual) for scatter and residual plots."""
    runs_dir = Path(settings.RUNS_DIR) / "osga"
    preds_file = runs_dir / f"preds_{split}.csv"
    if not preds_file.is_file():
        # Check parent or other runs
        preds_file = Path("runs/osga") / f"preds_{split}.csv"

    if not preds_file.is_file():
        return {
            "available": False,
            "split": split,
            "predictions": [],
            "total": 0,
            "message": f"No predictions file found for {split}. Run evaluation first.",
        }

    import pandas as pd
    df = pd.read_csv(preds_file)
    df["residual"] = df["pred"] - df["true"]
    data = []
    for _, r in df.iterrows():
        data.append({
            "id": str(r["id"]),
            "true_age": round(float(r["true"]), 1),
            "pred_age": round(float(r["pred"]), 1),
            "residual": round(float(r["residual"]), 1),
            "male": bool(r.get("male", 1)),
            "std": round(float(r.get("std", 0.0)), 2),
        })
    return {"available": True, "split": split, "total": len(data), "predictions": data}


@router.get("/subgroups")
def get_evaluation_subgroups(split: str = Query("val", description="'val' or 'test'")):
    """Returns subgroup performance stratified by sex and age bands."""
    eval_data = eval_service.get_evaluation(split=split)
    if not eval_data.get("available", False):
        return {
            "available": False,
            "split": split,
            "subgroups": {},
            "message": "Subgroup evaluation data not yet generated.",
        }
    return {
        "available": True,
        "split": split,
        "subgroups": eval_data.get("stratified", {}),
    }


@router.get("/ablation")
def get_ablation_summary():
    """Returns the five ablation configurations according to Table V of the research paper."""
    results = eval_service.get_ablations()
    return {"ablations": results}


@router.get("/literature")
def get_literature_baseline_table():
    """Returns published real-data RSNA test set results (Table IV)."""
    return eval_service.get_literature()
