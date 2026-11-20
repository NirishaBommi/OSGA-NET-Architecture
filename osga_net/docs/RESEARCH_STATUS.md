# OSGA-Net Research Project — Status & Scientific Disclosures

**Academic Integrity & Research Honesty Statement**  
*Final-Year Capstone Project — Structure-Aware Pediatric Bone Age Assessment*

---

## 1. Project Maturity Matrix

| Component | Technical Implementation | Empirical Verification | Current Repository Status |
|---|---|---|---|
| **Backbone & Landmark Head** | EfficientNetV2-S + Heatmap Soft-Argmax | Verified (Gradient & Dimension Tests) | Code Complete (`osga/model.py`) |
| **RoIAlign Feature Pooling** | Detached bounding box extraction | Verified (`return_aux=True`) | Code Complete |
| **FiLM Conditioning** | Metadata MLP + Node embeddings | Verified (Equivalence Tested) | Code Complete |
| **Graph Attention Network (GAT)** | 2-layer, 4-head dense GAT, 20 edges | Verified | Code Complete |
| **Ordinal Age Distribution Head** | 228-bin discrete distribution | Verified | Code Complete |
| **Training Pipeline** | 2-stage joint training with AdamW/AMP | Verified plumbing | Complete (`train.py`) |
| **Trained Model Checkpoint** | Full weights for RSNA cohort | Not Shipped | **Pending Training on Hardware** |
| **Ablation Matrix (Table V)** | 5 variants + 3 baselines | Scripts Complete (`ablation.py`) | **Pending Training on Hardware** |
| **Clinical Web Workstation** | Full-stack FastAPI + React UI | Verified & Tested | **Complete & Production-Ready** |

---

## 2. Mandatory Scientific Disclosures

### A. Checkpoint Absence
- **Disclosure:** This repository does not ship with pre-trained PyTorch weight checkpoints (`best.pt`).
- **Rationale:** Model weights (~150MB) must be trained on the RSNA Pediatric Bone Age challenge dataset using an appropriate GPU workstation or cloud cluster (e.g. Google Colab / Kaggle T4 / A100).
- **Workstation Behavior:** The application operates in **Demonstration Mode** or **Integration Pending Mode**, displaying explicit banners and watermarks. No random numbers or fabricated MAE/RMSE values are ever shown.

### B. Landmark Supervision Constraints
- **Disclosure:** The official RSNA 2017 challenge dataset contains radiographs and age labels, but **zero landmark coordinate annotations**.
- **Supervision Methods:**
  - `template`: A classical computer vision heuristic approximation (weak supervision). Assumes an upright hand radiograph with thumb oriented to the right. Useful for proof-of-concept.
  - `csv`: Precise coordinate ground truth provided by human annotators or exported pose estimation models.
  - `none`: Completely unsupervised landmark discovery (jointly trained with age loss).
- **Escobar Hand-Pose Prior:** The hand-pose estimation prior cited in preliminary literature is not bundled due to licensing and weight availability.

### C. Chronological Age Availability
- **Disclosure:** The RSNA dataset provides patient sex and bone age, but **omits chronological age**.
- **Model Impact:** In default configurations, FiLM modulation conditions exclusively on biological sex:
  $$\text{Metadata Vector} = [\text{male}, 0.0, 0.0]$$
- The full triple $[\text{male}, \text{chron\_norm}, \text{chron\_mask}]$ is activated only when external datasets provide chronological age and `--use_chron` is flagged.

### D. Literature Benchmark Comparisons (Table IV)
- **Disclosure:** Re-implementing every prior deep learning paper identically under identical splits is beyond capstone scope.
- **Protocol:**
  - Published numbers from Mao et al. (2022), Pan et al. (2020), Chen et al. (2021), etc. are quoted directly from their published peer-reviewed papers.
  - 3 baselines are genuinely re-implemented and trained identically: `ResNet-18`, `EfficientNetV2-S + Concat`, and `EfficientNetV2-S + Cross-Attention`.
  - The OSGA-Net row displays "Evaluation pending — awaiting complete training run" until `results/results.json` is generated from real validation runs.

---

## 3. Roadmap to Complete Thesis Evaluation

1. **Dataset Acquisition:**
   - Download the 14,236 image RSNA dataset via Kaggle or official RSNA challenge portal.
   - Run `python scripts/prepare_data.py --img_dir data/raw/images --csv data/raw/boneage.csv --out data/splits.csv`.

2. **Stage 1 & Stage 2 Training:**
   - Execute training run:
     ```bash
     python train.py --splits data/splits.csv --out runs/osga_full --amp
     ```

3. **Baseline & Ablation Evaluation:**
   - Run the 8-variant matrix:
     ```bash
     python ablation.py --splits data/splits.csv --root runs --epochs1 10 --epochs2 30
     ```
   - Aggregate metrics:
     ```bash
     python scripts/collect_results.py --split val --docx docs/OSGA-Net_paper.docx
     ```

4. **Workstation Integration:**
   - Point `CKPT_PATH` in `backend/.env` to `../runs/osga_full/best.pt`.
   - The workstation automatically switches to **Real Inference Mode** with full live model predictions and active XAI metrics.
