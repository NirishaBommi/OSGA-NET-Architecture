from __future__ import annotations
import asyncio
from typing import Any
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from ..services.training_service import training_manager

router = APIRouter(prefix="/training", tags=["Training"])


class TrainingStartConfig(BaseModel):
    splits_path: str | None = None
    img_size: int = 384
    batch_size: int = 4
    epochs1: int = 2
    epochs2: int = 4
    lr: float = 3e-4
    backbone_lr_mult: float = 0.1
    weight_decay: float = 1e-4
    lam: float = 0.3
    sigma: float = 6.0
    patience: int = 10
    resume: bool = False


@router.post("/start")
def start_training(config: TrainingStartConfig | None = None):
    cfg = config.dict() if config else {}
    return training_manager.start_training(**cfg)


@router.post("/pause")
def pause_training():
    return training_manager.pause_training()


@router.post("/resume")
def resume_training():
    return training_manager.resume_training()


@router.post("/stop")
def stop_training():
    return training_manager.stop_training()


@router.get("/status")
def get_training_status():
    return training_manager.get_status()


@router.get("/history")
def get_training_history():
    return {"history": training_manager.get_history()}


@router.get("/checkpoints")
def get_checkpoints():
    return {"checkpoints": training_manager.get_checkpoints()}


@router.post("/checkpoints/save")
def manual_save_checkpoint(name: str = "manual_checkpoint.pt"):
    import torch
    from pathlib import Path
    out_dir = training_manager.out_dir
    last_pt = out_dir / "last.pt"
    if not last_pt.is_file():
        raise HTTPException(status_code=404, detail="No active model state available to save")
    target = out_dir / name
    import shutil
    shutil.copyfile(last_pt, target)
    return {"status": "saved", "checkpoint": str(target)}


@router.websocket("/ws")
async def training_websocket(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def listener(event: dict[str, Any]):
        loop.call_soon_threadsafe(queue.put_nowait, event)

    training_manager.subscribe(listener)
    # Send initial status
    await websocket.send_json({"type": "init", "status": training_manager.get_status()})

    try:
        while True:
            # Check for incoming client messages or wait for training event
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        training_manager.unsubscribe(listener)
