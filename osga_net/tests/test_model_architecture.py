"""Unit tests for OSGA-Net model architecture, tensor dimensions, and probability calibration."""
from __future__ import annotations
import pytest
import torch
import numpy as np
from osga.model import OSGANet, build_model, NUM_BINS
from osga.landmarks import NUM_NODES, build_adjacency, EDGES


def test_adjacency_matrix():
    A = build_adjacency()
    assert A.shape == (13, 13)
    assert np.array_equal(A, A.T), "Adjacency matrix must be symmetric"
    assert np.all(np.diag(A) == 1), "Adjacency matrix must have self-loops"
    # Ensure all defined edges in EDGES exist in A
    for u, v in EDGES:
        assert A[u, v] == 1
        assert A[v, u] == 1


def test_osga_net_tensor_shapes():
    B = 2
    S = 384
    model = OSGANet(pretrained=False, use_landmark=True, use_film=True, use_gat=True, ordinal=True)
    model.eval()

    img = torch.randn(B, 3, S, S)
    male = torch.tensor([1.0, 0.0])
    chron = torch.tensor([120.0, 72.0])
    chron_mask = torch.tensor([1.0, 1.0])

    with torch.no_grad():
        out = model(img, male, chron, chron_mask, return_aux=True)

    # 1. Landmark head & coordinates
    assert out["heat"].shape == (B, 13, 48, 48), f"Expected [B, 13, 48, 48], got {out['heat'].shape}"
    assert out["coords"].shape == (B, 13, 2), f"Expected [B, 13, 2], got {out['coords'].shape}"
    assert (out["coords"] >= 0.0).all() and (out["coords"] <= 1.0).all(), "Coordinates must be normalized in [0, 1]"

    # 2. FiLM modulation parameters
    assert out["film_gamma"].shape == (B, 13, 1280), f"Expected [B, 13, 1280], got {out['film_gamma'].shape}"
    assert out["film_beta"].shape == (B, 13, 1280), f"Expected [B, 13, 1280], got {out['film_beta'].shape}"

    # 3. GAT attention coefficients
    assert len(out["gat_attention"]) == 2, "Expected 2 GAT layers"
    for a in out["gat_attention"]:
        assert a.shape == (B, 4, 13, 13), f"Expected [B, 4, 13, 13], got {a.shape}"

    # 4. Ordinal distribution head
    probs = out["probs"]
    assert probs.shape == (B, 228), f"Expected [B, 228], got {probs.shape}"
    # Sum to 1.0
    prob_sums = probs.sum(dim=-1)
    assert torch.allclose(prob_sums, torch.ones(B), atol=1e-4), "Probabilities must sum to 1.0"

    # 5. Expectation bone age
    bins = torch.arange(1, 229, dtype=torch.float32)
    expected_mean = (probs * bins).sum(dim=-1)
    assert torch.allclose(out["pred"], expected_mean, atol=1e-4), "Prediction must equal distribution expectation"

    # 6. Variance
    expected_var = (probs * (bins - expected_mean.unsqueeze(-1)) ** 2).sum(dim=-1)
    expected_std = expected_var.clamp_min(1e-8).sqrt()
    assert torch.allclose(out["std"], expected_std, atol=1e-4), "Uncertainty std must equal sqrt of variance"


def test_osga_ablations():
    B = 2
    S = 192  # Smaller for fast unit test
    img = torch.randn(B, 3, S, S)
    male = torch.tensor([1.0, 0.0])

    # 1. No GAT ablation
    m_no_gat = OSGANet(pretrained=False, use_gat=False)
    o_no_gat = m_no_gat(img, male)
    assert o_no_gat["pred"].shape == (B,)
    assert o_no_gat["probs"].shape == (B, 228)

    # 2. No FiLM ablation (concatenation instead)
    m_no_film = OSGANet(pretrained=False, use_film=False)
    o_no_film = m_no_film(img, male)
    assert o_no_film["pred"].shape == (B,)

    # 3. No Ordinal ablation (scalar regression instead)
    m_no_ord = OSGANet(pretrained=False, ordinal=False)
    o_no_ord = m_no_ord(img, male)
    assert o_no_ord["pred"].shape == (B,)
    assert "probs" not in o_no_ord

    # 4. No Landmark ablation (uniform spatial queries instead)
    m_no_lm = OSGANet(pretrained=False, use_landmark=False)
    o_no_lm = m_no_lm(img, male)
    assert o_no_lm["pred"].shape == (B,)
    assert o_no_lm["heat"] is None
