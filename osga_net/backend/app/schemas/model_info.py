from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


class ModelStatusResponse(BaseModel):
    checkpoint_present: bool
    checkpoint_loaded: bool
    checkpoint_path: str | None
    model_name: str
    img_size: int
    use_chron: bool
    use_landmark: bool
    use_film: bool
    use_gat: bool
    ordinal: bool
    landmark_source: str
    device: str
    calibration_threshold_p90: float | None
    mode: Literal["real_inference", "demonstration", "integration_pending"]
    disclaimer: str


class GraphEdge(BaseModel):
    source: int
    target: int
    name_source: str
    name_target: str


class ModelArchitectureResponse(BaseModel):
    model_name: str
    img_size: int
    backbone: str
    num_nodes: int
    num_edges: int
    nodes: list[dict]
    edges: list[GraphEdge]
    num_bins: int
    layers: list[dict]
