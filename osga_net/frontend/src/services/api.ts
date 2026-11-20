import {
  User,
  ModelStatus,
  ModelArchitecture,
  Assessment,
  DirectAssessmentResponse,
  PredictionResult,
  EvaluationResponse,
  AblationsResponse,
  LiteratureResponse,
} from "../types";

const BASE_URL = "/api";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include", // send and receive HTTP-only cookies
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // fallback to status text
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

// Authentication
export async function login(credentials: { username: string; password: string }): Promise<User> {
  return request<User>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

export async function register(data: { username: string; email: string; password: string; full_name?: string }): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("/auth/me");
  } catch {
    return null;
  }
}

// Model Information
export async function fetchModelStatus(): Promise<ModelStatus> {
  return request<ModelStatus>("/model/status");
}

export async function fetchModelArchitecture(): Promise<ModelArchitecture> {
  return request<ModelArchitecture>("/model/architecture");
}

// Assessments
export async function fetchAssessments(): Promise<Assessment[]> {
  return request<Assessment[]>("/assessments");
}

export async function fetchAssessment(id: string): Promise<Assessment> {
  return request<Assessment>(`/assessments/${id}`);
}

export async function createAssessment(data: {
  title?: string;
  patient_sex: "male" | "female";
  chronological_age_months?: number;
  reference_bone_age_months?: number;
  notes?: string;
}): Promise<Assessment> {
  return request<Assessment>("/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function uploadAssessmentImage(id: string, file: File): Promise<Assessment> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Assessment>(`/assessments/${id}/image`, {
    method: "POST",
    body: formData,
  });
}

export async function runInference(id: string): Promise<{ status: string; assessment_id: string; result_id: number }> {
  return request(`/assessments/${id}/infer`, {
    method: "POST",
  });
}

export async function runDemoInference(id: string): Promise<{ status: string; assessment_id: string; result_id: number; result_source: string }> {
  return request(`/assessments/${id}/demo-infer`, {
    method: "POST",
  });
}

export async function fetchAssessmentResults(id: string): Promise<PredictionResult> {
  return request<PredictionResult>(`/assessments/${id}/results`);
}

export async function deleteAssessment(id: string): Promise<void> {
  return request<void>(`/assessments/${id}`, {
    method: "DELETE",
  });
}

export async function directAssess(data: {
  file: File | Blob;
  sex: "male" | "female";
  chron_years?: number | null;
  run_demo?: boolean;
}): Promise<DirectAssessmentResponse> {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("sex", data.sex);
  if (data.chron_years !== undefined && data.chron_years !== null) {
    formData.append("chron_years", String(data.chron_years));
  }
  if (data.run_demo) {
    formData.append("run_demo", "true");
  }

  const res = await fetch(`${BASE_URL}/assessments/direct-assess`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    let errDetail = `Direct assessment failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.detail) errDetail = j.detail;
    } catch {
      // fallback
    }
    throw new Error(errDetail);
  }
  return res.json();
}

// Research & Benchmarks
export async function fetchEvaluation(split: string = "val"): Promise<EvaluationResponse> {
  return request<EvaluationResponse>(`/research/evaluation?split=${split}`);
}

export async function fetchAblations(split: string = "val"): Promise<AblationsResponse> {
  return request<AblationsResponse>(`/research/ablations?split=${split}`);
}

export async function fetchLiterature(): Promise<LiteratureResponse> {
  return request<LiteratureResponse>("/research/literature");
}

// Dataset
export async function fetchDatasetSummary(): Promise<any> {
  return request<any>("/dataset/summary");
}

// Training Engine
export async function fetchTrainingStatus(): Promise<any> {
  return request<any>("/training/status");
}

export async function fetchTrainingHistory(): Promise<any> {
  return request<any>("/training/history");
}

export async function fetchCheckpoints(): Promise<any> {
  return request<any>("/training/checkpoints");
}

export async function startTraining(config?: any): Promise<any> {
  return request<any>("/training/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config || {}),
  });
}

export async function pauseTraining(): Promise<any> {
  return request<any>("/training/pause", { method: "POST" });
}

export async function resumeTraining(): Promise<any> {
  return request<any>("/training/resume", { method: "POST" });
}

export async function stopTraining(): Promise<any> {
  return request<any>("/training/stop", { method: "POST" });
}

// Evaluation & System
export async function fetchEvaluationPredictions(split: string = "val"): Promise<any> {
  return request<any>(`/evaluation/predictions?split=${split}`);
}

export async function fetchSystemResources(): Promise<any> {
  return request<any>("/system/resources");
}
