from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class AssessmentCreate(BaseModel):
    title: str | None = None
    patient_sex: Literal["male", "female"]
    chronological_age_months: float | None = Field(None, ge=0, le=240)
    reference_bone_age_months: float | None = Field(None, ge=0, le=240)
    notes: str | None = None


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str | None
    patient_sex: str
    chronological_age_months: float | None
    reference_bone_age_months: float | None
    image_filename: str | None
    image_original_width: int | None
    image_original_height: int | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class LandmarkCoord(BaseModel):
    node_id: int
    name: str
    x_norm: float
    y_norm: float
    x_orig_px: float
    y_orig_px: float


class RegionBox(BaseModel):
    node_id: int
    name: str
    box_norm: list[float]  # [x1, y1, x2, y2] in 0..1 padded square
    box_orig_px: list[float]  # [x1, y1, x2, y2] in original pixels


class PredictionResultSchema(BaseModel):
    result_source: Literal["real_inference", "demonstration"]
    model: dict
    input: dict
    metadata: dict
    prediction: dict
    uncertainty: dict
    landmarks: list[LandmarkCoord]
    readout_weights: dict[str, float]
    regions: list[RegionBox] | None = None
    graph: dict
    film: dict | None = None
    timing_ms: float
    limitations: list[str]


class DirectAssessmentResponse(BaseModel):
    assessment: AssessmentOut
    result: PredictionResultSchema

