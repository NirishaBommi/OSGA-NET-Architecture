from __future__ import annotations
from fastapi import APIRouter, Query
from ..services.evaluation_service import evaluation_service
from ..schemas.research import EvaluationResponse, AblationsResponse, LiteratureResponse

router = APIRouter(prefix="/research", tags=["Research & Benchmarks"])


@router.get("/evaluation", response_model=EvaluationResponse)
def get_evaluation(split: str = Query("val", pattern="^(train|val|test)$")):
    return evaluation_service.get_evaluation(split=split)


@router.get("/ablations", response_model=AblationsResponse)
def get_ablations(split: str = Query("val", pattern="^(train|val|test)$")):
    return evaluation_service.get_ablations(split=split)


@router.get("/literature", response_model=LiteratureResponse)
def get_literature():
    return evaluation_service.get_literature()
