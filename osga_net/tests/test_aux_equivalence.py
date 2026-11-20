import os
import sys
import torch
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from osga.model import build_model
from osga.landmarks import NUM_NODES, NODE_NAMES
from osga.predictor import BoneAgePredictor


def test_model_aux_equivalence():
    """Verify that return_aux=True does not change pred, std, or probs."""
    torch.manual_seed(42)
    B, S = 2, 192
    m = build_model("osga", pretrained=False)
    m.eval()

    img = torch.randn(B, 3, S, S)
    male = torch.tensor([0.0, 1.0])
    chron = torch.tensor([48.0, 120.0])
    chron_mask = torch.tensor([1.0, 1.0])

    with torch.no_grad():
        out_standard = m(img, male, chron, chron_mask, return_aux=False)
        out_aux = m(img, male, chron, chron_mask, return_aux=True)

    # 1. Prediction equality
    assert torch.allclose(out_standard["pred"], out_aux["pred"], atol=1e-7), "Predictions differ!"
    assert torch.allclose(out_standard["probs"], out_aux["probs"], atol=1e-7), "Probabilities differ!"
    assert torch.allclose(out_standard["std"], out_aux["std"], atol=1e-7), "Std dev differs!"
    assert torch.allclose(out_standard["node_weights"], out_aux["node_weights"], atol=1e-7), "Node weights differ!"
    assert torch.allclose(out_standard["coords"], out_aux["coords"], atol=1e-7), "Landmark coords differ!"

    # 2. Auxiliary fields present only in return_aux=True
    assert "roi_boxes" in out_aux and out_aux["roi_boxes"] is not None
    assert out_aux["roi_boxes"].shape == (B, NUM_NODES, 4)
    assert "gat_attention" in out_aux and len(out_aux["gat_attention"]) == 2
    assert out_aux["gat_attention"][0].shape == (B, 4, NUM_NODES, NUM_NODES)
    assert "film_gamma" in out_aux and out_aux["film_gamma"] is not None
    assert "film_beta" in out_aux and out_aux["film_beta"] is not None
    assert "pre_film_norm" in out_aux and out_aux["pre_film_norm"].shape == (B, NUM_NODES)
    assert "post_film_norm" in out_aux and out_aux["post_film_norm"].shape == (B, NUM_NODES)

    assert "roi_boxes" not in out_standard
    assert "gat_attention" not in out_standard

    print("PASS: test_model_aux_equivalence")


if __name__ == "__main__":
    test_model_aux_equivalence()
