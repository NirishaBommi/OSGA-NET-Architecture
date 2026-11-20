export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export type ModelMode = "real_inference" | "demonstration" | "integration_pending";

export interface ModelStatus {
  checkpoint_present: boolean;
  checkpoint_loaded: boolean;
  checkpoint_path: string | null;
  model_name: string;
  img_size: number;
  use_chron: boolean;
  use_landmark: boolean;
  use_film: boolean;
  use_gat: boolean;
  ordinal: boolean;
  landmark_source: string;
  device: string;
  calibration_threshold_p90: number | null;
  mode: ModelMode;
  disclaimer: string;
}

export interface GraphEdge {
  source: number;
  target: number;
  name_source: string;
  name_target: string;
}

export interface ModelArchitecture {
  model_name: string;
  img_size: number;
  backbone: string;
  num_nodes: number;
  num_edges: number;
  nodes: Array<{
    id: number;
    name: string;
    display_name: string;
    region_type: string;
  }>;
  edges: GraphEdge[];
  num_bins: number;
  layers: Array<{
    id: string;
    name: string;
    type: string;
    input_shape: string;
    output_shape: string;
    description: string;
    source_file: string;
    equation: string;
  }>;
}

export interface Assessment {
  id: string;
  title: string | null;
  patient_sex: "male" | "female";
  chronological_age_months: number | null;
  reference_bone_age_months: number | null;
  image_filename: string | null;
  image_original_width: number | null;
  image_original_height: number | null;
  status: "created" | "uploaded" | "completed" | "failed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandmarkCoord {
  node_id: number;
  name: string;
  x_norm: number;
  y_norm: number;
  x_orig_px: number;
  y_orig_px: number;
}

export interface RegionBox {
  node_id: number;
  name: string;
  box_norm: [number, number, number, number];
  box_orig_px: [number, number, number, number];
}

export interface DirectAssessmentResponse {
  assessment: Assessment;
  result: PredictionResult;
}

export interface PredictionResult {
  result_source: "real_inference" | "demonstration";
  model: {
    name: string;
    version: string;
    checkpoint_id: string | null;
    img_size: number;
  };
  input: {
    width: number;
    height: number;
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
    probability_distribution: number[];
    difference_from_chronological_months: number | null;
    difference_from_reference_months: number | null;
  };
  uncertainty: {
    method: string;
    variance: number;
    standard_deviation: number;
    central_95_mass_interval_months: [number, number];
    needs_review: boolean | null;
    calibrated: boolean;
    calibration_threshold: number | null;
  };
  landmarks: LandmarkCoord[];
  readout_weights: Record<string, number>;
  regions: RegionBox[] | null;
  graph: {
    nodes: Array<{ id: number; name: string }>;
    edges: Array<[number, number]>;
    attention?: number[][][][] | null;
  };
  film: {
    gamma_summary: { min: number; max: number; mean: number } | null;
    beta_summary: { min: number; max: number; mean: number } | null;
    pre_film_norm: number[] | null;
    post_film_norm: number[] | null;
  } | null;
  timing_ms: number;
  limitations: string[];
}

export interface EvaluationResponse {
  available: boolean;
  split: string | null;
  overall: {
    n: number;
    mae: number;
    rmse: number;
    acc_6mo: number;
    acc_12mo: number;
    mae_ci95?: [number, number];
  } | null;
  stratified: {
    female?: { n: number; mae: number; rmse: number; acc_6mo: number; acc_12mo: number };
    male?: { n: number; mae: number; rmse: number; acc_6mo: number; acc_12mo: number };
    younger_band?: { n: number; mae: number; rmse: number; acc_6mo: number; acc_12mo: number };
    older_band?: { n: number; mae: number; rmse: number; acc_6mo: number; acc_12mo: number };
  } | null;
  calibration: {
    pearson_std_vs_abs_err: number | null;
    reliability: Array<{ bin_min: number; bin_max: number; mean_pred_std: number; mean_abs_err: number; count: number }>;
  } | null;
  predictions_count: number;
  note: string;
}

export interface AblationRow {
  label: string;
  key: string;
  status: "completed" | "not_run";
  mae: number | null;
  rmse: number | null;
  acc6: number | null;
  acc12: number | null;
  n: number | null;
  ci95: [number, number] | null;
  pct_change_vs_full: number | null;
}

export interface AblationsResponse {
  available: boolean;
  split: string | null;
  ablations: AblationRow[];
  baselines: AblationRow[];
  note: string;
}

export interface LiteratureEntry {
  method: string;
  year: number;
  mae: number | null;
  mad: number | null;
  metric_name: string;
  reference: string;
  is_proposed_model: boolean;
  status: string;
  note: string;
}

export interface LiteratureResponse {
  entries: LiteratureEntry[];
  disclaimer: string;
}
