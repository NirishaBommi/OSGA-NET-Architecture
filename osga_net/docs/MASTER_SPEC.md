# OSGA-Net Medical Workstation — Master Product Specification

**Project:** OSGA-Net: Structure-Aware Bone Age Assessment  
**System:** Full-Stack Medical AI Imaging Workstation  
**Version:** 2.0 (Clinical Research & Evaluation Prototype)  
**Standard:** IEEE & Medical Imaging Research Transparency Guidelines

---

## 1. Vision & Core Principles

OSGA-Net Workstation is a specialized radiological decision-support workstation designed for pediatric bone age assessment (BAA). The application bridges machine learning research and clinical interpretability by opening the "black box" of bone age assessment: decomposing the radiograph into 13 anatomically identified ossification centers, conditioning them via Feature-wise Linear Modulation (FiLM), reasoning across their maturation dependencies using Graph Attention Networks (GAT), and outputting a full 228-bin ordinal age distribution with calibrated uncertainty.

### Non-Negotiable Honesty & Transparency Rules
1. **No Fabricated Data or Results**: Synthetic metrics, fake MAE/RMSE numbers, random heatmaps, or fabricated patient demographics are strictly prohibited.
2. **Three Operational States**:
   - **Real Inference**: An actual trained checkpoint (`.pt`) is loaded and actively performing PyTorch inference.
   - **Demonstration Mode**: Explicitly marked sample mock cases used exclusively for interface demonstration and viva presentations. Every visual, chart, and export bears a prominent "DEMONSTRATION ONLY" indicator.
   - **Integration Pending**: Default state when no checkpoint or evaluation runs are available. Shows clean, informative empty-state placeholders.
3. **Strict Data Store Isolation**: Demonstration data never pollutes the research evaluation, ablation, or clinical database statistics.
4. **Mandatory Research Disclaimer**: Prominently displayed across all views and PDF reports:
   > *"Research prototype for bone-age assessment. Results are intended for research and educational demonstration and must not be used as the sole basis for clinical decisions."*

---

## 2. Information Architecture & Navigation

The workstation interface is built around an imaging-focused desktop layout:
- **Top Header**: System title, active operational mode badge, current user profile, quick links to GitHub/Docs, and system health status.
- **Persistent Bottom/Banner Notice**: Mandatory clinical disclaimer.
- **Collapsible Sidebar**: Organized into four functional groups:
  1. **Clinical Assessment**:
     - Dashboard (`/dashboard`)
     - New Assessment (`/assessments/new`)
     - Study History (`/assessments`)
  2. **Model Deep Dives & Interpretability**:
     - Imaging Workspace & Viewer (`/assessments/:id/viewer`)
     - Preprocessing Pipeline (`/assessments/:id/preprocessing`)
     - Architecture Explorer (`/architecture`)
     - Landmark Localization (`/assessments/:id/landmarks`)
     - Regional RoI Features (`/assessments/:id/regions`)
     - FiLM Metadata Conditioning (`/assessments/:id/film`)
     - Graph Attention Network (`/assessments/:id/graph`)
     - Prediction & Distribution (`/assessments/:id/prediction`)
     - Uncertainty & Review (`/assessments/:id/uncertainty`)
  3. **Scientific Benchmarks**:
     - Benchmark Evaluation (`/research/evaluation`)
     - Ablation Study (`/research/ablations`)
     - Literature Comparison (`/research/literature`)
     - Research Status & Timeline (`/research/status`)
  4. **Presentation & Export**:
     - Clinical Report (`/assessments/:id/report`)
     - Presentation Mode (`/presentation`)

---

## 3. Data Model & Database Schemas

### 3.1 SQLite Database Schema
The database uses SQLite with SQLAlchemy ORM and Alembic migrations:
- **`users`**:
  - `id` (INTEGER, Primary Key)
  - `username` (VARCHAR, Unique, Indexed)
  - `email` (VARCHAR, Unique, Indexed)
  - `hashed_password` (VARCHAR)
  - `full_name` (VARCHAR)
  - `role` (VARCHAR, default="researcher")
  - `created_at` (DATETIME)
- **`assessments`**:
  - `id` (VARCHAR, Primary Key, e.g., `STUDY-2026-XXXX`)
  - `user_id` (INTEGER, Foreign Key to `users.id`, Indexed)
  - `title` (VARCHAR)
  - `patient_sex` (VARCHAR: `male` | `female`)
  - `chronological_age_months` (FLOAT, Nullable)
  - `reference_bone_age_months` (FLOAT, Nullable)
  - `image_path` (VARCHAR)
  - `image_original_width` (INTEGER)
  - `image_original_height` (INTEGER)
  - `status` (VARCHAR: `created` | `processing` | `completed` | `failed`)
  - `notes` (TEXT, Nullable)
  - `created_at` (DATETIME)
- **`assessment_results`**:
  - `id` (INTEGER, Primary Key)
  - `assessment_id` (VARCHAR, Foreign Key to `assessments.id`, Unique, Indexed)
  - `result_source` (VARCHAR: `real_inference` | `demonstration`)
  - `model_name` (VARCHAR)
  - `model_version` (VARCHAR)
  - `bone_age_months` (FLOAT)
  - `uncertainty_std_months` (FLOAT)
  - `needs_review` (BOOLEAN, Nullable)
  - `interval_95_min` (FLOAT)
  - `interval_95_max` (FLOAT)
  - `distribution_json` (TEXT) — 228 probability floats
  - `landmarks_json` (TEXT) — 13 landmark coordinate pairs (normalized & pixel)
  - `node_weights_json` (TEXT) — 13 node attention weights
  - `roi_boxes_json` (TEXT, Nullable)
  - `gat_attention_json` (TEXT, Nullable)
  - `film_summary_json` (TEXT, Nullable)
  - `created_at` (DATETIME)
- **`audit_events`**:
  - `id` (INTEGER, Primary Key)
  - `user_id` (INTEGER, Nullable)
  - `event_type` (VARCHAR)
  - `details` (TEXT)
  - `timestamp` (DATETIME)

---

## 4. API Endpoints Specification

### 4.1 Authentication & Health
- `POST /api/auth/register`: Create user account.
- `POST /api/auth/login`: Authenticate and set HTTP-only cookie with JWT.
- `POST /api/auth/logout`: Clear session cookie.
- `GET /api/auth/me`: Return current user profile.
- `GET /api/health`: Health status of database and model runtime.

### 4.2 Model Status & Architecture
- `GET /api/model/status`:
  ```json
  {
    "checkpoint_present": false,
    "checkpoint_loaded": false,
    "checkpoint_path": null,
    "model_name": "osga",
    "img_size": 384,
    "use_chron": false,
    "use_landmark": true,
    "use_film": true,
    "use_gat": true,
    "ordinal": true,
    "landmark_source": "template",
    "device": "cpu",
    "calibration_threshold_p90": null,
    "mode": "integration_pending"
  }
  ```
- `GET /api/model/architecture`: Layer definitions, node names, and edge connections.

### 4.3 Assessments & Inference
- `GET /api/assessments`: List user's assessments with pagination and filters.
- `POST /api/assessments`: Create a new study record.
- `POST /api/assessments/{id}/image`: Upload radiograph file (PNG/JPEG with binary magic check).
- `POST /api/assessments/{id}/infer`: Trigger model inference. Returns 503 if no checkpoint is available.
- `GET /api/assessments/{id}`: Assessment details and image metadata.
- `GET /api/assessments/{id}/results`: Full typed inference result payload.
- `GET /api/assessments/{id}/report`: Server-generated PDF summary report.
- `DELETE /api/assessments/{id}`: Delete assessment and associated image assets.

### 4.4 Research & Benchmarking
- `GET /api/evaluation`: Aggregate evaluation metrics loaded from `runs/*/metrics_*.json`.
- `GET /api/ablations`: Model variant performance (Table V).
- `GET /api/literature`: Seed table of published literature results (Table IV).

---

## 5. Result Schema & Auxiliary Outputs (Part 26)

The prediction payload returned by `/api/assessments/{id}/results` conforms to:
```typescript
interface PredictionResult {
  result_source: "real_inference" | "demonstration";
  model: {
    name: string;
    version: string;
    checkpoint_id: string | null;
    img_size: number;
    use_chron: boolean;
    use_film: boolean;
    use_gat: boolean;
    landmark_source: string;
  };
  input: {
    width: number;
    height: number;
    pad_x: number;
    pad_y: number;
    side: number;
    preprocessing: string[];
  };
  metadata: {
    sex: "male" | "female";
    chronological_age_months: number | null;
    reference_bone_age_months: number | null;
  };
  prediction: {
    bone_age_months: number;
    bone_age_formatted: string;
    most_probable_age_months: number;
    probability_distribution: number[]; // 228 values
    difference_from_chronological_months: number | null;
    difference_from_reference_months: number | null;
  };
  uncertainty: {
    method: "ordinal_distribution_std";
    variance: number;
    standard_deviation: number;
    central_95_mass_interval_months: [number, number];
    needs_review: boolean | null;
    calibrated: boolean;
    threshold_operating_point: number | null;
  };
  landmarks: Array<{
    node_id: number;
    name: string;
    x_norm: number; // 0..1 in padded square
    y_norm: number;
    x_orig_px: number; // mapped back to original image
    y_orig_px: number;
  }>;
  readout_weights: Record<string, number>; // Attention readout per node
  regions: Array<{
    node_id: number;
    name: string;
    box_px: [number, number, number, number]; // [x1, y1, x2, y2]
  }> | null;
  graph: {
    nodes: Array<{ id: number; name: string }>;
    edges: Array<[number, number]>;
    edge_attention: number[][][][] | null; // [layer][head][13][13]
  };
  film: {
    gamma_summary: { min: number; max: number; mean: number } | null;
    beta_summary: { min: number; max: number; mean: number } | null;
    pre_film_norm: number[] | null;
    post_film_norm: number[] | null;
  } | null;
  heatmaps_available: boolean;
  timing_ms: number;
  limitations: string[];
}
```

---

## 6. Implementation Architecture

```
osga_net/
  osga/                     Core ML Package (PyTorch)
    dataset.py              Shared preprocessing (CLAHE, padding, norm)
    model.py                OSGANet, GATLayer, feature extraction
    landmarks.py            13 nodes, 20 edges, template CV
    predictor.py            Inference engine wrapper
  backend/                  FastAPI Service
    app/
      main.py               App entry point and route mounting
      core/
        config.py           Environment variables & paths
        security.py         Password hashing & JWT tokens
        deps.py             Dependency injection (DB, Current User)
      db/
        base.py             SQLAlchemy declarative base
        session.py          SQLite session manager
        models.py           User, Assessment, Result, Audit
      schemas/              Pydantic v2 schemas
      api/
        auth.py             User authentication endpoints
        assessments.py      Study management, upload, inference
        model.py            Model status, layers, architecture
        research.py         Evaluation, ablations, literature
      services/
        inference_service.py Singleton wrapper around BoneAgePredictor
        evaluation_service.py Runs metrics & baseline reader
        report_service.py   PDF generator (ReportLab)
  frontend/                 React 19 + TypeScript + Vite
    src/
      components/           Workstation UI components & Viewer
      pages/                Workflow & Deep-Dive views
      services/             API client with TanStack Query
      types/                Strict TypeScript API contracts
```
