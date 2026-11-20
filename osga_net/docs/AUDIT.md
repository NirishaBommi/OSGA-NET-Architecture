# OSGA-Net Workstation — Repository Audit & Implementation Plan

**Date:** November 2026  
**Auditor:** Senior Full-Stack & ML Systems Engineer  
**Workspace Root:** `osga_net/` (under `OSGA-Net_Code_v2/`)  
**Scope:** Clinical AI Imaging Workstation for OSGA-Net (Structure-Aware Bone Age Assessment)

---

## 1. Executive Summary & Verification of Facts

This audit verifies the initial state of the repository against the architectural specifications, academic paper, and repository constraints. The baseline Python repository (`osga/`) implements the machine learning core described in the OSGA-Net paper. All core mathematical models, pipelines, and baseline implementations are syntactically and structurally sound.

### Verification of Repository Facts

| Spec / Fact Item | Expected | Verified in Code | Source Reference |
|---|---|---|---|
| **Backbone** | EfficientNetV2-S (1280-d at stride 32; 12×12 for 384×384) | Confirmed | `osga/model.py:effnet_features` |
| **Landmark Head** | 13 heatmaps at `img_size/8` (48×48 for 384), soft-argmax to [0, 1] | Confirmed | `osga/model.py:heat_head`, `soft_argmax` |
| **RoIAlign** | 2×2 output, averaged; boxes centered on soft-argmax coords; detached coords | Confirmed | `osga/model.py:node_features` |
| **FiLM Modulation** | $x' = (1 + \gamma) \odot x + \beta$; zero-initialized; conditioned on metadata MLP | Confirmed | `osga/model.py:OSGANet.forward` |
| **GAT Layer** | 2-layer, 4-head dense GAT, 256 per head (1024 out), LayerNorm + residual | Confirmed | `osga/model.py:GATLayer` |
| **Graph Topology** | 13 anatomical nodes, 20 undirected edges + self-loops | Confirmed | `osga/landmarks.py:NODE_NAMES, EDGES, build_adjacency` |
| **Attention Readout** | `node_weights` is attention over nodes; GAT edge attention currently discarded | Confirmed | `osga/model.py:81, 134-135, 138` |
| **Ordinal Regression** | 228 discrete bins (months 1..228); expected value $\sum k \cdot p(k)$, std $\sqrt{\text{Var}}$ | Confirmed | `osga/model.py:142-146` |
| **Image Preprocessing** | Grayscale $\to$ CLAHE (clip 2.0, 8×8 grid) $\to$ Square padding (border median) $\to$ Resize to `img_size` $\to$ 3-channel repeat $\to$ ImageNet normalization | Confirmed | `osga/dataset.py:prepare_image, to_tensor` |
| **Uncertainty Operating Point** | `needs_review` from `calibration.json` 90th percentile threshold; research operating point | Confirmed | `osga/predictor.py:28-29, 48-49` |
| **Ablation Configurations** | `use_landmark`, `use_film`, `use_gat`, `ordinal` flags present | Confirmed | `osga/model.py:46-53` |
| **Plumbing Test** | `tests/smoke_test.py` passes end-to-end | Confirmed (exited 0: `ALL PLUMBING CHECKS PASSED`) | `tests/smoke_test.py` |

---

## 2. Inventory of What Exists vs. What is Missing

### A. Existing Components
- **Model Package (`osga/`)**:
  - `landmarks.py`: Node names (13), edge list (20), adjacency generator, template landmarks, bounding box detector.
  - `dataset.py`: `prepare_image`, `to_tensor`, `BoneAgeDataset` with augmentation and label formatting.
  - `model.py`: `OSGANet`, `GATLayer`, `effnet_features`, soft-argmax, coordinate embedding, FiLM modulation.
  - `baselines.py`: `ResNet18Baseline`, `EffNetConcatBaseline`, `EffNetCrossAttnBaseline`.
  - `losses.py`: `gaussian_soft_labels`, `total_loss` (ordinal KL + landmark heatmap MSE).
  - `metrics.py`: MAE, RMSE, Acc $\le$ 6mo/12mo, bootstrap confidence intervals, stratified metrics, reliability bins.
  - `engine.py`: Training engine and evaluator.
  - `predictor.py`: `BoneAgePredictor` inference wrapper.
- **Scripts & Tools**:
  - `train.py`, `evaluate.py`, `ablation.py`, `compare.py`, `scripts/prepare_data.py`, `scripts/collect_results.py`.
- **Existing App Demos**:
  - `app/api.py`: Minimal FastAPI mock.
  - `app/gradio_app.py`: Standalone Gradio interface.
- **Documents in `docs/`**:
  - `OSGA-Net_paper.docx`: Source IEEE-style manuscript with Table IV (published baselines) and Table V (ablation plan).
  - `OSGA-Net_Execution_Guide.docx`: Execution protocol and replication instructions.
  - `osga_architecture.png`: Architectural visual diagram.

### B. Missing / Required Components to Build
1. **Model Enhancements (`osga/model.py`, `osga/predictor.py`)**:
   - Optional `return_aux=False` parameter in `OSGANet.forward` and `BoneAgePredictor.predict` returning:
     - Landmark heatmaps (`13 x H/8 x W/8`)
     - Bounding boxes for RoIAlign
     - Layer 1 and Layer 2 GAT multi-head edge attention matrices (`2 layers x 4 heads x 13 x 13`)
     - FiLM modulation parameters $\gamma$ and $\beta$ summaries
     - Pre- and post-FiLM node vector norms
   - Coordinate transformation metadata: `pad_x, pad_y, S, w, h` in `predict()` to map landmarks and heatmaps back to the original image dimensions.
2. **Backend API (`backend/`)**:
   - SQLite DB via SQLAlchemy with models: `User`, `Assessment`, `AssessmentResult`, `AuditEvent`.
   - Security: Argon2 password hashing, JWT in `httpOnly`, `SameSite=lax` cookies, user isolation in all DB queries.
   - Robust Upload Pipeline: Magic bytes check, MIME validation (PNG/JPEG only; DICOM safely handled/clarified), dimension checks, blank/low-contrast image advisory detection.
   - Typed Model Status API: Reports checkpoint availability, `img_size`, `use_chron`, device, calibration state, mode (`real_inference`, `demonstration`, or `integration_pending`).
   - Assessment & Inference Endpoints: Async task execution or synchronous predictable execution, error handling (503 when no checkpoint, typed OOM / invalid input handling).
   - Evaluation & Ablation APIs: Reading real `metrics_*.json`, `preds_*.csv`, and `results.json` from `runs/`, returning structured empty-state payloads if absent.
   - Literature Comparison API: Structured database of published RSNA benchmarks (Table IV) with clear badges indicating different experimental protocols.
   - PDF Report Generator: High-resolution multi-page PDF export using ReportLab with cover page, clinical summary, visual overlays, architecture diagram, and honesty disclosures.
3. **Frontend Workstation (`frontend/`)**:
   - Modern React + TypeScript + Vite application styled with Tailwind CSS and Radix/shadcn-inspired components.
   - Medical workstation UX: Clean dark viewer canvas, high-contrast typography, teal/navy medical color palette, persistent honesty disclaimer, and mode badge (`Real Inference`, `Demonstration Mode`, `Integration Pending`).
   - Interactive Hand X-Ray Viewer: Pan, zoom, windowing/brightness/contrast (explicitly labelled *viewer-only display adjustment*), toggleable overlays (landmarks, RoI boxes, heatmaps, graph edges) with correct inverse-pad scaling.
   - Model Architecture Explorer: Interactive diagram (React Flow) visualizing the 5 core stages with tensor shapes parameterized by `img_size`, equations, code links, and implementation status.
   - Deep Dive Pages:
     - Landmark Localization & Heatmaps (per-node heatmap slice viewing)
     - Regional RoI Feature Extraction
     - FiLM Modulation (per-node scale and shift distributions)
     - Graph Attention Network (interactive 13-node, 20-edge topology with head selection)
     - Prediction & Uncertainty (228-bin probability density curve, mean, mode, 95% central mass interval, review flag)
   - Research & Evaluation Suite:
     - Benchmark Evaluation (scatter plots, residual distributions, subgroup sex/age strata)
     - Ablation Study Table (Table V real metrics vs full model)
     - Literature Leaderboard (Table IV published vs pending OSGA-Net)
     - Research Status & Project Timeline
     - Guided Presentation Mode (11 structured tour stages for defense/demonstration)
4. **Documentation & Verification**:
   - `docs/ARCHITECTURE.md`, `docs/MODEL_INTEGRATION.md`, `docs/RESEARCH_STATUS.md`, `docs/PRESENTATION_GUIDE.md`, and updated root `README.md`.

---

## 3. Deviations from Spec & Justifications

1. **Working Directory & Path Organization**:
   - Workspace root is `C:\Users\dilee\Downloads\OSGA-Net_Code_v2`. The existing codebase is rooted in `osga_net/`.
   - All backend code will reside in `osga_net/backend/` and frontend code in `osga_net/frontend/` to keep imports (`import osga...`) clean and preserve the existing package hierarchy without moving original files.
2. **`docs/MASTER_SPEC.md`**:
   - The user prompt specifies the exact page requirements, schemas, UX flows, and honesty rules. We synthesize and document this directly in `docs/MASTER_SPEC.md` for complete specification traceability.
3. **DICOM Handling**:
   - Per non-negotiable honesty rules, no fake DICOM parser will be claimed. The upload endpoint strictly validates standard medical export formats (PNG, JPEG), transparently documenting that clinical PACS DICOM files must be converted/exported prior to upload.
4. **Uncertainty Interpretation**:
   - Standard deviation $\sigma$ and 95% mass interval are derived from the 228-bin ordinal softmax distribution. They are explicitly labelled as central distribution spread, not clinically calibrated confidence intervals, until external calibration data is generated.

---

## 4. Phase-by-Phase Implementation Plan

### Phase 0: Audit & Architecture Blueprint (Current)
- Complete repository audit, fact verification, and system architecture blueprint.
- Produce `docs/AUDIT.md` and initial `docs/MASTER_SPEC.md`.

### Phase 1: Backend Infrastructure & Security
- Setup FastAPI structure in `osga_net/backend/app/`: `core/config.py`, `core/security.py`, `db/models.py`, `db/session.py`, `schemas/`, `api/`.
- SQLite database schema: `users`, `assessments`, `assessment_results`, `audit_events`.
- Implement authentication with Argon2 password hashing and HTTP-only JWT cookies.
- Upload validation engine: magic numbers (PNG `\x89PNG\r\n\x1a\n`, JPEG `\xff\xd8\xff`), decode verification via OpenCV, size ceiling (15MB), blank/low-contrast image check.
- Health check and truthful `/api/model/status` reporting.
- Comprehensive backend test suite (`pytest`) testing auth, user data isolation, and validation filters.

### Phase 2: Additive Model Instrumentation
- Update `osga/model.py`:
  - Add `return_aux=False` keyword argument to `OSGANet.forward()`.
  - Capture GAT layer 1 and layer 2 edge-attention weights `a1, a2` (`(B, heads, 13, 13)`).
  - Capture FiLM scale $\gamma$ and shift $\beta$ tensors, along with pre- and post-modulation norms.
  - Compute RoI bounding boxes in pixel and normalized coordinates.
- Update `osga/predictor.py`:
  - Pass through `return_aux` to `model(...)`.
  - Capture `(px, py, S, w, h)` from `prepare_image(...)`.
  - Map predicted landmark coordinates back to original unpadded image coordinates: $x_{orig} = (x_{norm} \cdot S - px) / w$, $y_{orig} = (y_{norm} \cdot S - py) / h$.
  - Format full result payload including auxiliary heatmaps, graph edges, and attention weights.
- Verification:
  - Add test verifying `pred` and `probs` are strictly bit-identical (`torch.allclose`) with `return_aux=True` vs `return_aux=False`.
  - Re-run `python tests/smoke_test.py` to ensure zero regression.

### Phase 3: Frontend Foundation & App Shell
- Initialize Vite + React 19 + TypeScript + Tailwind CSS project in `osga_net/frontend/`.
- Setup medical design system: Navy/Teal/Slate color tokens, clean typography, dark viewer styling.
- Implement AppShell: Header with persistent honesty banner and mode badge (`Real Inference`, `Demonstration`, `Integration Pending`), responsive navigation sidebar organized into logical groups (Clinical Workflow, Model Internals, Research & Benchmarks, Reports & Defense).
- Implement auth flows (Login, Register, Session recovery) with HTTP-only cookie support.

### Phase 4: Clinical Assessment Workflow
- Dashboard with real case counts, recent study table, and empty states.
- New Assessment wizard:
  - Metadata form: Sex selection, optional chronological age (hidden with clear badge when `use_chron=False` in checkpoint), study title/notes.
  - Image uploader: Drag-and-drop, client preview, upload progress, validation feedback (size, format, contrast advisory).
  - Study History: Paginated table, filtering by sex/date/review status, detail view, deletion.

### Phase 5: Imaging Workspace & Interpretability Suite
- Workstation Viewer:
  - Canvas with pan, zoom, fit-to-screen, reset, fullscreen.
  - Display-only brightness and contrast adjustments (clearly labelled as viewer-only).
  - Layer manager: Toggle hand radiograph, 13 landmark points, RoI bounding boxes, 20 graph edges, and landmark heatmap overlays.
  - Accurate coordinate transformation ensuring markers align with true anatomical structures.
- Preprocessing Inspector: Step-by-step interactive view of grayscale conversion, CLAHE enhancement, border-median square padding, and resize.
- Architecture Explorer: Interactive node-graph (React Flow) depicting the 5 processing stages, data dimensions, formulas, and source code anchors.
- Anatomical Landmark & Heatmap Deep Dive: Interactive selector for all 13 nodes, inspecting individual Gaussian heatmap activations and coordinates.
- FiLM Modulation View: Conceptual and empirical visualization of sex/age conditioning effects on node features.
- Graph Attention Topology: Graph visualization of 13 ossification centers and 20 anatomical edges with attention head selectors and clear clinical interpretability disclaimers.

### Phase 6: Prediction, Distribution & Uncertainty
- Bone Age Assessment Card: Formatted age (Years + Months), difference from chronological age (if provided).
- Probability Distribution: 228-bin interactive distribution chart showing the expected value $\mathbb{E}[k]$, distribution mode (highest probability bin), and central 95% mass range.
- Uncertainty Analysis: Standard deviation $\sigma$, variance, review flag status (calibrated vs uncalibrated operating point), explicit explanation of limits.

### Phase 7: Research & Scientific Benchmarking
- Model Evaluation Dashboard: Real performance metrics from `runs/`, predicted vs reference scatter plot, error residual histograms, stratified performance by sex and age bands (empty state if not evaluated).
- Ablation Study Table: Table V comparison across all 5 OSGA configurations and 3 controlled baselines with exact percentage changes.
- Published Literature Comparison: Table IV historical leaderboard with clear citations, measurement protocols, and OSGA-Net pending status.
- Research Status & Project Timeline: Academic milestone tracking, supervisor/institution configuration, transparent capability matrix.

### Phase 8: Reports, Presentation & Demonstration Mode
- Server-side PDF Generator (ReportLab):
  - Structured multi-page PDF with institutional header, patient/study metadata, original image with landmark overlay, predicted bone age and uncertainty interval, 13-region attention readout table, model architecture summary, and research disclaimer.
- Presentation Mode: 11-stage interactive guided walkthrough for thesis presentation/viva with step-by-step narration and visual focus.
- Demonstration Mode: Clearly labelled demonstration dataset for testing workstation functionality without requiring model training or sensitive patient data.

### Phase 9: Verification, Quality Assurance & Documentation
- End-to-end verification:
  - Backend `pytest` suite testing all endpoints, user isolation, and security.
  - Model auxiliary output equivalence tests.
  - Existing `smoke_test.py` execution.
  - Frontend typecheck (`tsc --noEmit`), linting, and production build (`npm run build`).
  - Browser verification of key user flows.
- Comprehensive documentation:
  - Root `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/MODEL_INTEGRATION.md`
  - `docs/RESEARCH_STATUS.md`
  - `docs/PRESENTATION_GUIDE.md`
