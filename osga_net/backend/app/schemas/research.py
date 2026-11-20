from __future__ import annotations
from typing import Any
from pydantic import BaseModel


class EvaluationResponse(BaseModel):
    available: bool
    split: str | None
    overall: dict | None
    stratified: dict | None
    calibration: dict | None
    predictions_count: int
    note: str


class AblationRow(BaseModel):
    label: str
    key: str
    status: str  # "completed" | "not_run"
    mae: float | None
    rmse: float | None
    acc6: float | None
    acc12: float | None
    n: int | None
    ci95: list[float] | None
    pct_change_vs_full: float | None


class AblationsResponse(BaseModel):
    available: bool
    split: str | None
    ablations: list[AblationRow]
    baselines: list[AblationRow]
    note: str


class LiteratureEntry(BaseModel):
    method: str
    year: int
    mae: float | None
    mad: float | None = None
    metric_name: str
    reference: str
    is_proposed_model: bool
    status: str
    note: str


class LiteratureResponse(BaseModel):
    entries: list[LiteratureEntry]
    disclaimer: str
