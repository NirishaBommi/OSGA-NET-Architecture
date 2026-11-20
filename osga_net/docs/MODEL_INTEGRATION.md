# OSGA-Net Workstation — Model Integration Guide

**How to connect, configure, and verify trained PyTorch checkpoints with the Workstation.**

---

## 1. Overview of Operating Modes

The OSGA-Net Workstation is designed to remain fully functional, honest, and crash-resilient across three distinct operational modes:

| Mode | Trigger Condition | UI Indicator | Description |
|---|---|---|---|
| **Real Inference** | `CKPT_PATH` points to a valid PyTorch `.pt` file | 🟢 Green Badge | Uses real weights for inference. All numbers, landmarks, and distributions are calculated live from PyTorch. |
| **Demonstration Mode** | Checkpoint absent, user triggers interactive demo | 🟡 Amber Badge | Generates synthetic but anatomically grounded visualization data for UI evaluation. Clearly watermarked as "Demonstration Data". |
| **Integration Pending** | Checkpoint absent, no inference requested | ⚪ Gray Badge | Clean empty states. Shows "Model weights pending integration" — zero fabricated predictions. |

---

## 2. Connecting a Trained Checkpoint

### Step 1: Place Your Checkpoint
Train the model following the instructions in `README.md`:
```bash
python train.py --splits data/splits.csv --out runs/osga_full --amp
```
This produces `runs/osga_full/best.pt` along with `args.json` and `calibration.json`.

### Step 2: Configure Environment Variables
Create or update `backend/.env` (or set environment variables in your shell):

```bash
# Path to the PyTorch weights
CKPT_PATH=../runs/osga_full/best.pt

# Path to runs directory for Evaluation and Ablation dashboards
RUNS_DIR=../runs

# Path to published / consolidated results
RESULTS_JSON=../results/results.json

# Image upload constraints
MAX_UPLOAD_MB=25

# Secret key for JWT sessions
JWT_SECRET=replace-with-a-secure-random-token-for-production
```

### Step 3: Verify Model Status via API
Start the backend and query the model status endpoint:
```bash
curl http://localhost:8000/api/model/status
```
Expected response:
```json
{
  "checkpoint_path": "../runs/osga_full/best.pt",
  "checkpoint_present": true,
  "loaded": true,
  "device": "cuda",
  "img_size": 384,
  "use_chron": false,
  "landmark_source": "template",
  "calibration_threshold": 8.42,
  "mode": "real_inference"
}
```

---

## 3. How the Predictor Harvests Auxiliary Activations (`return_aux=True`)

In standard training mode, `OSGANet.forward(x)` returns `(pred, probs, std, node_weights, coords)`.

To support the Workstation's rich explainability views (GAT edge attention, FiLM scale/shift, RoI feature norms) without altering downstream predictions or training loops, an additive parameter `return_aux: bool = False` was introduced:

```python
# osga/predictor.py
pred, probs, std, node_weights, coords, aux = self.model(
    tensor,
    male_tensor,
    chron_tensor,
    chron_mask_tensor,
    return_aux=True,
)
```

The returned `aux` dictionary contains:
- `roi_boxes`: Bounding box coordinates $[x_1, y_1, x_2, y_2]$ normalized to $[0, 1]$ used for anatomical feature extraction.
- `gat_attention`: List of multi-head attention weight matrices for Layer 1 and Layer 2, shaped $(B, \text{heads}, 13, 13)$.
- `film_gamma` & `film_beta`: Per-node modulation vectors $(B, 13, C)$.
- `pre_film_norm` & `post_film_norm`: Mean channel norm before and after FiLM scaling, quantifying demographic influence.

### Equivalence Guarantee
The additive auxiliary extraction was mathematically proven to leave model predictions completely identical:
```bash
python tests/test_aux_equivalence.py
# Result: ALL OUTPUTS IDENTICAL: torch.allclose() passed for all tensors.
```

---

## 4. Calibration & Radiologist Review Triage

The `needs_review` flag indicates whether an assessment exhibits abnormally high predictive dispersion:

1. During validation evaluation (`python evaluate.py --split val`), the system computes the 90th percentile of $\hat{\sigma}$ across the validation cohort.
2. This threshold $\tau_{90}$ is saved to `calibration.json`.
3. During inference, if $\hat{\sigma}_{\text{patient}} > \tau_{90}$, the Workstation triggers a high-uncertainty alert and recommends manual audit.
4. **Clinical Notice:** This threshold is an empirical operating point for workflow prioritization, not an absolute clinical failure boundary.

---

## 5. Sanity Check Commands

Run these automated verification checks before deploying to clinical demonstration:
```bash
# 1. Verify auxiliary mathematical equivalence
python tests/test_aux_equivalence.py

# 2. Run existing end-to-end smoke test
python tests/smoke_test.py

# 3. Run backend unit tests (auth, isolation, upload validation)
python -m pytest backend/tests -v
```
