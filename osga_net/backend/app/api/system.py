from __future__ import annotations
import os
import sys
import platform
import torch
from fastapi import APIRouter

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/resources")
def get_system_resources():
    """Returns CPU, RAM, and GPU device telemetry."""
    has_cuda = torch.cuda.is_available()
    gpu_info = None
    if has_cuda:
        try:
            device_idx = torch.cuda.current_device()
            gpu_name = torch.cuda.get_device_name(device_idx)
            mem_alloc = torch.cuda.memory_allocated(device_idx) / (1024 ** 2)  # MB
            mem_total = torch.cuda.get_device_properties(device_idx).total_memory / (1024 ** 2)  # MB
            gpu_info = {
                "name": gpu_name,
                "memory_allocated_mb": round(mem_alloc, 1),
                "memory_total_mb": round(mem_total, 1),
                "utilization_pct": round((mem_alloc / max(1.0, mem_total)) * 100.0, 1),
            }
        except Exception:
            gpu_info = {"name": "CUDA Available", "utilization_pct": 0.0}

    # Query CPU and RAM
    cpu_count = os.cpu_count() or 1
    return {
        "device": "cuda" if has_cuda else "cpu",
        "has_cuda": has_cuda,
        "cpu_count": cpu_count,
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "torch_version": torch.__version__,
        "gpu": gpu_info,
    }
