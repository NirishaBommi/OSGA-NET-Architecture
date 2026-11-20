# OSGA-Net — Ossification-Structure Graph Attention Network for Bone Age Assessment

Runnable PyTorch implementation + application layer for the paper *OSGA-Net* (hand X-ray bone age,
RSNA Pediatric Bone Age data). **Research prototype - not a medical device.**

---

## 0. Read this first (honest scope)
| Item | Status |
|---|---|
| Model, losses, 2-stage training, ablations, 3 re-implemented baselines | Implemented, plumbing-tested |
| Results / MAE numbers | **None shipped.** You must train on real RSNA data; every number is produced by your own run. |
| Landmark supervision | RSNA has no landmark labels. Options: `csv` (your real annotations, preferred), `template` (classical-CV *approximation*, weak supervision, assumes upright hand, thumb on right), `none`. The paper's "Escobar et al. hand-pose prior" model is **not bundled**; if you use it, export its landmarks to CSV and use `--landmark_source csv`. |
| Chronological age in FiLM | RSNA provides **no** chronological age. Default FiLM uses **sex only**. `--use_chron` works only if you add a `chron_months` column (e.g. from another dataset). Make the paper text consistent with what you actually train. |
| Baselines | ResNet-18, EfficientNetV2-S + concat fusion, EfficientNetV2-S + cross-attention are re-implemented. Chen / Mao / Pan / Lou etc. are **not** re-implemented - cite their published numbers. |
| Smoke test | `tests/smoke_test.py` uses random/noise images: shapes, gradients, CLI, resume, API. It proves wiring only. |
| Clinical Workstation | Full-stack FastAPI + React 18 / TypeScript / Vite web application with interactive canvas viewer, 13-landmark overlay, GAT attention graph, FiLM explorer, ordinal distribution charts, and ReportLab PDF exports. |

---

## 1. Layout
```
osga/                   landmarks.py dataset.py model.py baselines.py losses.py metrics.py engine.py predictor.py
backend/                FastAPI application service (auth, db, schemas, services, api routers)
  app/                  main.py, core/, db/, schemas/, services/, api/
  tests/                backend pytest suite (auth, user isolation, upload validation, demo inference, PDF generation, SPA)
frontend/               React 18 + TypeScript + Vite workstation UI
  src/                  components/, pages/, services/, types/, App.tsx, main.tsx
docs/                   AUDIT.md, MASTER_SPEC.md, ARCHITECTURE.md, MODEL_INTEGRATION.md, RESEARCH_STATUS.md, PRESENTATION_GUIDE.md
scripts/prepare_data.py build splits.csv (+5 CV folds) from RSNA files
scripts/collect_results.py collect evaluation metrics into results/results.json
train.py evaluate.py compare.py ablation.py
app/gradio_app.py app/api.py   legacy Gradio demo and REST service
tests/smoke_test.py            end-to-end repository plumbing verification
tests/test_aux_equivalence.py  mathematical equivalence proof for auxiliary extraction
```

---

## 2. Clinical Web Workstation

### 2.0 One-Click Launch (Windows)

Simply double-click `run_workstation.bat` (or execute `.\run_workstation.ps1` in PowerShell).
This automatically activates the Python environment, starts the FastAPI server on `http://127.0.0.1:8000`, and opens the dashboard in your default browser.

### 2.1 Quickstart (Development Mode)

#### Backend (FastAPI):
```bash
# In osga_net/
pip install -r requirements.txt
pip install -r backend/requirements.txt   # FastAPI, SQLAlchemy, Argon2, ReportLab, etc.

# Start backend server on port 8000
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend (React + Vite):
```bash
# In osga_net/frontend/
npm install
npm run dev
# Open http://localhost:5173
```

### 2.2 Production Build & Single-Port Serving

You can compile the frontend into optimized static assets and serve both the API and UI from the FastAPI server on a single port:

```bash
# 1. Build frontend bundle
cd frontend
npm run build
cd ..

# 2. Run backend (automatically mounts frontend/dist for all SPA routes)
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
# Open http://localhost:8000
```

### 2.3 Running Automated Tests

```bash
# 1. Auxiliary extraction equivalence test (torch.allclose verification)
python tests/test_aux_equivalence.py

# 2. End-to-end repository plumbing smoke test
python tests/smoke_test.py

# 3. Backend pytest suite (Auth, User Isolation, Uploads, Demo Mode, PDF, SPA fallback)
python -m pytest backend/tests -v

# 4. Frontend TypeScript check & production bundle build
cd frontend && npm run build
```

---

## 3. Workstation Operating Modes

The workstation features a persistent header badge indicating the system's operational state:

1. **Real Inference (Green Badge):**
   Active when `CKPT_PATH` points to a trained PyTorch model checkpoint (`best.pt`). Live predictions, coordinates, and uncertainty are computed by `osga/predictor.py`.
2. **Demonstration Mode (Amber Badge):**
   Activated when no checkpoint is present and the user clicks **Run Demonstration Assessment**. Produces realistic, anatomically grounded hand visualizations clearly watermarked as demonstration data.
3. **Integration Pending (Gray Badge):**
   Clean empty states shown when no checkpoint is loaded and no demonstration is active. No fabricated numbers are ever displayed.

---

## 4. Get the Real Data (RSNA 2017 Challenge)

RSNA Pediatric Bone Age Challenge 2017 (14,236 images). A common mirror is the Kaggle dataset `kmader/rsna-bone-age`:
```bash
pip install kaggle   # put kaggle.json in ~/.kaggle
kaggle datasets download -d kmader/rsna-bone-age -p data/raw --unzip
```

Prepare splits:
```bash
python scripts/prepare_data.py --img_dir data/raw/boneage-training-dataset/boneage-training-dataset \
       --csv data/raw/boneage-training-dataset.csv --out data/splits.csv
```

---

## 5. Training OSGA-Net

```bash
# Stage 1 + Stage 2 Joint Training (GPU recommended)
python train.py --splits data/splits.csv --out runs/osga_full --amp

# Resume training after timeout
python train.py --splits data/splits.csv --out runs/osga_full --amp --resume
```

Stage 1 (20 epochs) pre-trains the landmark head with the heatmap loss; stage 2 ($\le 50$ epochs) trains jointly with KL divergence on soft ordinal labels + 0.3 * heatmap MSE, AdamW, cosine LR schedule.

---

## 6. Evaluation, Baselines, Ablations

```bash
# 1. Validation evaluation & calibration.json generation
python evaluate.py --ckpt runs/osga_full/best.pt --splits data/splits.csv --split val

# 2. Run ablation matrix (5 OSGA variants + 3 baselines)
python ablation.py --splits data/splits.csv --root runs --epochs1 10 --epochs2 30

# 3. Paired bootstrap significance test (1000 resamples)
python compare.py runs/osga_full/preds_val.csv runs/base_effnet_concat/preds_val.csv

# 4. Consolidate results into results.json and paper tables
python scripts/collect_results.py --split val --docx docs/OSGA-Net_paper.docx
```

---

## 7. Documentation Index

- [`docs/MASTER_SPEC.md`](file:///docs/MASTER_SPEC.md): Full page-by-page workstation UX and functional specification.
- [`docs/AUDIT.md`](file:///docs/AUDIT.md): Initial codebase audit, verified architecture facts, and plan.
- [`docs/ARCHITECTURE.md`](file:///docs/ARCHITECTURE.md): System topology, security model, database schema, and XAI pipelines.
- [`docs/MODEL_INTEGRATION.md`](file:///docs/MODEL_INTEGRATION.md): Guide to loading trained PyTorch weights and configuring auxiliary outputs.
- [`docs/RESEARCH_STATUS.md`](file:///docs/RESEARCH_STATUS.md): Academic honesty disclosure, dataset limitations, and thesis roadmap.
- [`docs/PRESENTATION_GUIDE.md`](file:///docs/PRESENTATION_GUIDE.md): 11-stage defense presentation guide and committee Q&A script.
