import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileText,
  Flame,
  Grid,
  HardDrive,
  Info,
  Layers,
  Loader2,
  Network,
  Play,
  Pause,
  RefreshCw,
  Share2,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Upload,
  User as UserIcon,
  XCircle,
} from "lucide-react";

import {
  directAssess,
  fetchModelStatus,
  fetchModelArchitecture,
  fetchDatasetSummary,
  fetchTrainingStatus,
  fetchTrainingHistory,
  fetchCheckpoints,
  startTraining,
  pauseTraining,
  resumeTraining,
  stopTraining,
  fetchEvaluation,
  fetchEvaluationPredictions,
  fetchAblations,
  fetchLiterature,
  fetchSystemResources,
} from "../services/api";

import {
  ModelStatus,
  ModelArchitecture,
  DirectAssessmentResponse,
  PredictionResult,
  LandmarkCoord,
  AblationRow,
  LiteratureEntry,
} from "../types";

// Standard 13 anatomical names
const ANATOMICAL_NAMES = [
  "Distal Radius",
  "Distal Ulna",
  "Carpal Cluster (Radial)",
  "Carpal Cluster (Central)",
  "Carpal Cluster (Ulnar)",
  "Carpal Cluster (Proximal)",
  "Metacarpal I Head",
  "Metacarpal II Head",
  "Metacarpal III Head",
  "Metacarpal IV Head",
  "Metacarpal V Head",
  "Phalanx Reference I (Proximal)",
  "Phalanx Reference II (Distal)",
];

export const ResearchWorkstation: React.FC = () => {
  // Navigation: overview | analyze | training | evaluation | architecture
  const [activeTab, setActiveTab] = useState<"overview" | "analyze" | "training" | "evaluation" | "architecture">("overview");

  // Analysis Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [patientSex, setPatientSex] = useState<"male" | "female">("female");
  const [chronYears, setChronYears] = useState<string>("12.0");
  const [showLandmarkOverlay, setShowLandmarkOverlay] = useState<boolean>(true);
  const [currentAssessment, setCurrentAssessment] = useState<any | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PredictionResult | null>(null);
  const [assessing, setAssessing] = useState<boolean>(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Training Telemetry State
  const [trainConfigOpen, setTrainConfigOpen] = useState(false);
  const [trainEpochs1, setTrainEpochs1] = useState(2);
  const [trainEpochs2, setTrainEpochs2] = useState(4);
  const [trainBatchSize, setTrainBatchSize] = useState(2);
  const [trainActionLoading, setTrainActionLoading] = useState(false);
  const [evalSplit, setEvalSplit] = useState<"val" | "test">("val");
  const [subgroupFilter, setSubgroupFilter] = useState("all");

  // Queries
  const { data: modelStatus, refetch: refetchModelStatus } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
    refetchInterval: 10000,
  });

  const { data: datasetSummary } = useQuery({
    queryKey: ["datasetSummary"],
    queryFn: fetchDatasetSummary,
  });

  const { data: trainingStatus, refetch: refetchTrainingStatus } = useQuery({
    queryKey: ["trainingStatus"],
    queryFn: fetchTrainingStatus,
    refetchInterval: 2500,
  });

  const { data: trainingHistory, refetch: refetchTrainingHistory } = useQuery({
    queryKey: ["trainingHistory"],
    queryFn: fetchTrainingHistory,
    refetchInterval: 5000,
  });

  const { data: checkpoints, refetch: refetchCheckpoints } = useQuery({
    queryKey: ["checkpoints"],
    queryFn: fetchCheckpoints,
    refetchInterval: 10000,
  });

  const { data: evaluationData } = useQuery({
    queryKey: ["evaluation", evalSplit],
    queryFn: () => fetchEvaluation(evalSplit),
  });

  const { data: evalPredictions } = useQuery({
    queryKey: ["evalPredictions", evalSplit],
    queryFn: () => fetchEvaluationPredictions(evalSplit),
  });

  const { data: ablationsData } = useQuery({
    queryKey: ["ablations", evalSplit],
    queryFn: () => fetchAblations(evalSplit),
  });

  const { data: literatureData } = useQuery({
    queryKey: ["literature"],
    queryFn: fetchLiterature,
  });

  const { data: systemInfo } = useQuery({
    queryKey: ["systemInfo"],
    queryFn: fetchSystemResources,
    refetchInterval: 15000,
  });

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
      setAnalysisResult(null);
      setAssessmentError(null);
    }
  };

  // Run Inference
  const handleRunAssessment = async () => {
    if (!selectedFile) return;
    setAssessing(true);
    setAssessmentError(null);
    try {
      const chronNum = chronYears ? parseFloat(chronYears) : null;
      const resp = await directAssess({
        file: selectedFile,
        sex: patientSex,
        chron_years: chronNum,
      });
      setCurrentAssessment(resp.assessment);
      setAnalysisResult(resp.result);
      refetchModelStatus();
    } catch (err: any) {
      setAssessmentError(err.message || "Assessment inference failed");
    } finally {
      setAssessing(false);
    }
  };

  // Training Controls
  const handleStartTrain = async () => {
    setTrainActionLoading(true);
    try {
      await startTraining({
        epochs1: trainEpochs1,
        epochs2: trainEpochs2,
        batch_size: trainBatchSize,
      });
      setTrainConfigOpen(false);
      refetchTrainingStatus();
    } catch (err: any) {
      alert(err.message || "Failed to start training");
    } finally {
      setTrainActionLoading(false);
    }
  };

  const handlePauseTrain = async () => {
    setTrainActionLoading(true);
    try {
      await pauseTraining();
      refetchTrainingStatus();
    } catch (err: any) {
      alert(err.message || "Failed to pause training");
    } finally {
      setTrainActionLoading(false);
    }
  };

  const handleResumeTrain = async () => {
    setTrainActionLoading(true);
    try {
      await resumeTraining();
      refetchTrainingStatus();
    } catch (err: any) {
      alert(err.message || "Failed to resume training");
    } finally {
      setTrainActionLoading(false);
    }
  };

  const handleStopTrain = async () => {
    if (!confirm("Are you sure you want to stop training?")) return;
    setTrainActionLoading(true);
    try {
      await stopTraining();
      refetchTrainingStatus();
    } catch (err: any) {
      alert(err.message || "Failed to stop training");
    } finally {
      setTrainActionLoading(false);
    }
  };

  // Derived Values
  const isTrained = modelStatus?.checkpoint_loaded ?? false;
  const historyList = trainingHistory?.history ?? [];
  const trainState = trainingStatus?.status ?? "idle";
  const isTrainingActive = trainState.startsWith("running");

  return (
    <div className="flex min-h-screen bg-[#f7f9fd] text-[#202d48] font-sans antialiased">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 fixed inset-y-0 left-0 bg-white border-r border-[#e9edf5] p-6 flex flex-col z-30 shadow-sm">
        <div className="flex items-center gap-3 pb-8 px-2 border-b border-[#f0f2f8]">
          <div className="w-10 h-10 rounded-xl bg-[#101522] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            OS
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight text-[#142042]">
              OSGA<span className="text-[#6378ec]">-Net</span>
            </div>
            <div className="text-[11px] font-semibold text-[#8c98ad]">Bone Age AI Workstation</div>
          </div>
        </div>

        <div className="mt-6 text-[10px] font-bold tracking-widest text-[#a7b0c1] uppercase px-3 mb-3">
          Research Workspace
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: "overview", icon: Grid, label: "Overview" },
            { id: "analyze", icon: FileText, label: "X-ray Analysis" },
            { id: "training", icon: Activity, label: "Model Training" },
            { id: "evaluation", icon: BarChart3, label: "Evaluation" },
            { id: "architecture", icon: Layers, label: "Architecture" },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-semibold text-xs text-left transition-all ${
                  active
                    ? "bg-[#edf0ff] text-[#5b6de0] shadow-sm font-bold"
                    : "text-[#78859b] hover:bg-[#f4f6ff] hover:text-[#6579ec]"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#5b6de0]" : "text-[#9aa6bd]"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="mt-auto bg-gradient-to-br from-[#f0efff] to-[#eaf6ff] p-4 rounded-2xl border border-[#e2e6fa] text-xs">
          <div className="flex items-center gap-2 font-bold text-[#354366]">
            <Sparkles className="w-3.5 h-3.5 text-[#6378ec]" />
            OSGA-Net Research
          </div>
          <p className="text-[11px] text-[#7887a4] mt-1.5 leading-relaxed">
            13-region GAT with per-node FiLM conditioning & ordinal distribution regression.
          </p>
          <div className="mt-2.5 pt-2 border-t border-[#d8e0f5] flex items-center justify-between text-[10px] font-semibold text-[#8492b0]">
            <span>Device: {systemInfo?.device?.toUpperCase() || "CPU"}</span>
            <span>v2.0</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="ml-64 flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#e9edf5] flex items-center justify-between px-8 z-20 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#9ba5b5]">Workspace</span>
            <span className="text-xs text-[#cbd3e0]">/</span>
            <span className="text-xs font-bold text-[#34405a] capitalize">
              {activeTab === "analyze" ? "X-ray Analysis" : activeTab}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Pill */}
            {isTrainingActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#edf0ff] text-[#5b6de0] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#5b6de0]"></span>
                Training ({trainingStatus?.stage === 1 ? "Stage 1 Heatmaps" : "Stage 2 Joint"})
              </span>
            ) : isTrained ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e6f8f3] text-[#2ba388]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ba388]" />
                Real Model Loaded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fff4e8] text-[#d48b3b]">
                <Clock className="w-3.5 h-3.5 text-[#d48b3b]" />
                Integration Pending
              </span>
            )}

            <div className="w-8 h-8 rounded-full bg-[#edf0ff] text-[#6378ec] font-bold text-xs flex items-center justify-center">
              AI
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 max-w-7xl mx-auto w-full flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-[#7e8a9f] uppercase tracking-wider">OSGA-Net / Workspace</div>
                  <h1 className="text-2xl font-extrabold text-[#1a253c] mt-1 tracking-tight">Overview Dashboard</h1>
                  <p className="text-xs text-[#8c98ad] mt-1">
                    Structured bone age assessment via anatomical graph attention and calibrated ordinal regression.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("analyze")}
                  className="px-4 py-2 bg-[#6378ec] hover:bg-[#5267dc] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
                >
                  Assess Radiograph <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7e8a9f]">
                    <span>Anatomical landmarks</span>
                    <div className="w-8 h-8 rounded-lg bg-[#edf0ff] text-[#6378ec] flex items-center justify-center">
                      <Network className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-[#1a253c] mt-3">13 <span className="text-xs font-semibold text-[#8c98ad]">regions</span></div>
                  <div className="text-[11px] text-[#33ad91] mt-2 flex items-center gap-1 font-semibold">
                    <Info className="w-3 h-3" /> Soft-argmax localized
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7e8a9f]">
                    <span>Age distribution</span>
                    <div className="w-8 h-8 rounded-lg bg-[#f3eeff] text-[#a181ed] flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-[#1a253c] mt-3">228 <span className="text-xs font-semibold text-[#8c98ad]">bins</span></div>
                  <div className="text-[11px] text-[#33ad91] mt-2 flex items-center gap-1 font-semibold">
                    <Info className="w-3 h-3" /> Monthly 1–228m classes
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7e8a9f]">
                    <span>Attention layers</span>
                    <div className="w-8 h-8 rounded-lg bg-[#e5f8f3] text-[#3db9a2] flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-[#1a253c] mt-3">2 <span className="text-xs font-semibold text-[#8c98ad]">GAT</span></div>
                  <div className="text-[11px] text-[#33ad91] mt-2 flex items-center gap-1 font-semibold">
                    <Info className="w-3 h-3" /> 4 attention heads each
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7e8a9f]">
                    <span>Input resolution</span>
                    <div className="w-8 h-8 rounded-lg bg-[#fff3e6] text-[#e9a15e] flex items-center justify-center">
                      <Sliders className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-[#1a253c] mt-3">384 <span className="text-xs font-semibold text-[#8c98ad]">× 384</span></div>
                  <div className="text-[11px] text-[#33ad91] mt-2 flex items-center gap-1 font-semibold">
                    <Info className="w-3 h-3" /> CLAHE square padded
                  </div>
                </div>
              </div>

              {/* Training Performance & Workflow Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-bold text-sm text-[#1e293b]">Training Performance (Logged History)</h3>
                      <p className="text-xs text-[#8c98ad]">Loss progression across Stage 1 and Stage 2</p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#edf0ff] text-[#6378ec]">
                      {historyList.length > 0 ? `${historyList.length} Epochs Logged` : "Pending Training"}
                    </span>
                  </div>

                  {historyList.length > 0 ? (
                    <div className="space-y-4">
                      {/* Simple SVG Chart */}
                      <div className="h-44 w-full flex items-end gap-2 pt-4 px-2 border-b border-[#f0f2f8]">
                        {historyList.map((h: any, idx: number) => {
                          const maxLoss = Math.max(...historyList.map((x: any) => x.train_loss || 1.0));
                          const heightPct = Math.min(100, Math.max(10, ((h.train_loss || 0.1) / maxLoss) * 100));
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full rounded-t-md transition-all ${
                                  h.stage === 1 ? "bg-[#7185ee]" : "bg-[#3cbda8]"
                                } group-hover:brightness-90`}
                                title={`Epoch ${h.epoch} (${h.stage === 1 ? "Stage 1" : "Stage 2"}): Loss ${h.train_loss}${
                                  h.val_mae ? `, Val MAE ${h.val_mae}m` : ""
                                }`}
                              />
                              <span className="text-[9px] text-[#9ca7b8]">{h.epoch}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-6 text-xs text-[#7e8a9f]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#7185ee]"></span> Stage 1 (Heatmaps)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3cbda8]"></span> Stage 2 (Joint + MAE)
                        </span>
                        {trainingStatus?.best_mae && (
                          <span className="ml-auto font-bold text-[#142042]">
                            Best Val MAE: {trainingStatus.best_mae.toFixed(1)} months
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 flex flex-col items-center justify-center text-xs text-[#8c98ad]">
                      <Activity className="w-8 h-8 text-[#cbd4e5] mb-2" />
                      No training history found. Start a training run in the Model Training tab.
                    </div>
                  )}
                </div>

                {/* 5-step Pipeline Card */}
                <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-[#1e293b]">Workflow Pipeline</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f1f3f9] text-[#78879e]">
                      5 Steps
                    </span>
                  </div>

                  <div className="space-y-3 flex-1">
                    {[
                      { icon: Upload, title: "1. Upload Radiograph", desc: "Left-hand X-ray image (PNG/JPEG)" },
                      { icon: Sliders, title: "2. Standard Preprocessing", desc: "CLAHE + square pad + 384x384 resize" },
                      { icon: Network, title: "3. Landmark Detection", desc: "13 ossification center heatmaps" },
                      { icon: Layers, title: "4. Graph Attention & FiLM", desc: "Per-node modulation + 2 GAT layers" },
                      { icon: BarChart3, title: "5. Calibrated Ordinal Age", desc: "Expectation & uncertainty variance" },
                    ].map((step, idx) => {
                      const Icon = step.icon;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-[#edf0ff] text-[#6378ec] flex items-center justify-center flex-shrink-0 text-xs">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#2a3650]">{step.title}</div>
                            <div className="text-[11px] text-[#93a0b4]">{step.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: X-RAY ANALYSIS */}
          {activeTab === "analyze" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-[#7e8a9f] uppercase tracking-wider">OSGA-Net / Inference</div>
                  <h1 className="text-2xl font-extrabold text-[#1a253c] mt-1 tracking-tight">X-ray Radiograph Analysis</h1>
                  <p className="text-xs text-[#8c98ad] mt-1">
                    Upload a pediatric left-hand radiograph to run real-time anatomical inference.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-white border border-[#d8e0f0] text-xs font-bold text-[#55637e] rounded-xl flex items-center gap-2 hover:bg-[#f8faff] transition shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Select Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Upload & Image Viewer (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h3 className="font-bold text-sm text-[#1e293b]">Radiograph View</h3>
                        <p className="text-[11px] text-[#8c98ad]">13 anatomical ossification centers</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-[#6b7a94] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLandmarkOverlay}
                          onChange={(e) => setShowLandmarkOverlay(e.target.checked)}
                          className="rounded text-[#6378ec]"
                        />
                        Show Landmarks Overlay
                      </label>
                    </div>

                    {/* Image Area */}
                    <div
                      onClick={() => !previewUrl && fileInputRef.current?.click()}
                      className={`relative min-h-[380px] bg-[#fbfcfe] rounded-xl border-2 border-dashed flex items-center justify-center p-4 overflow-hidden ${
                        previewUrl ? "border-[#e0e6f5]" : "border-[#d8e0f2] hover:border-[#6378ec] cursor-pointer"
                      }`}
                    >
                      {previewUrl ? (
                        <div className="relative inline-block max-w-full max-h-[460px]">
                          <img
                            src={previewUrl}
                            alt="Uploaded Hand Radiograph"
                            className="max-h-[460px] object-contain rounded-lg mx-auto"
                          />
                          {/* SVG Landmark Overlay */}
                          {showLandmarkOverlay && analysisResult?.landmarks && (
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >
                              {analysisResult.landmarks.map((lm: LandmarkCoord, i: number) => {
                                const weight = analysisResult.readout_weights?.[String(i)] ?? 0.07;
                                const radius = Math.max(1.5, Math.min(4.5, weight * 25));
                                return (
                                  <g key={i}>
                                    <circle
                                      cx={lm.x_norm * 100}
                                      cy={lm.y_norm * 100}
                                      r={radius}
                                      fill="#6378ec"
                                      fillOpacity={0.65}
                                      stroke="#ffffff"
                                      strokeWidth="0.6"
                                    />
                                    <text
                                      x={lm.x_norm * 100 + 2}
                                      y={lm.y_norm * 100 - 2}
                                      fill="#142042"
                                      fontSize="2.5"
                                      fontWeight="bold"
                                    >
                                      {i + 1}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Upload className="w-10 h-10 text-[#7b8cf0] mx-auto mb-3" />
                          <div className="text-sm font-bold text-[#2a3650]">Click or Drag & Drop Hand X-ray</div>
                          <div className="text-xs text-[#98a5b8] mt-1">PNG or JPEG format · Automatically preprocessed</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[#8c98ad]">
                      <span>{selectedFile ? selectedFile.name : "No file selected"}</span>
                      {selectedFile && (
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            setAnalysisResult(null);
                          }}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Metadata & Prediction Controls (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Patient Info Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                    <h3 className="font-bold text-sm text-[#1e293b] mb-1">Patient Clinical Metadata</h3>
                    <p className="text-[11px] text-[#8c98ad] mb-4">Required for per-node FiLM conditioning</p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-[#5e6c86] block mb-1.5">Sex</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["female", "male"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setPatientSex(s)}
                              className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                                patientSex === s
                                  ? "bg-[#6378ec] text-white border-[#6378ec] shadow-xs"
                                  : "bg-[#f8faff] text-[#6b7994] border-[#e2e7f4] hover:bg-[#edf2fc]"
                              }`}
                            >
                              {s === "female" ? "Female" : "Male"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#5e6c86] block mb-1.5">
                          Chronological Age (Years, Optional)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="19"
                          value={chronYears}
                          onChange={(e) => setChronYears(e.target.value)}
                          placeholder="e.g. 11.5"
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#d8e0f2] focus:outline-none focus:border-[#6378ec] bg-[#fbfcfe]"
                        />
                      </div>

                      <button
                        onClick={handleRunAssessment}
                        disabled={!selectedFile || assessing}
                        className="w-full py-3 bg-[#20b9a9] hover:bg-[#19a596] disabled:bg-[#cbd4e5] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                      >
                        {assessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Processing OSGA-Net...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" /> Estimate Bone Age
                          </>
                        )}
                      </button>

                      {assessmentError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{assessmentError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estimation Results Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm text-[#1e293b]">Bone Age Estimation</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          analysisResult?.result_source === "real_inference"
                            ? "bg-[#e6f8f3] text-[#2ba388]"
                            : analysisResult
                            ? "bg-[#fff3e6] text-[#e08f3a]"
                            : "bg-[#f1f3f9] text-[#8e9bb0]"
                        }`}
                      >
                        {analysisResult?.result_source === "real_inference"
                          ? "Real Inference"
                          : analysisResult
                          ? "Demonstration"
                          : "Awaiting Input"}
                      </span>
                    </div>

                    {analysisResult ? (
                      <div className="space-y-3">
                        <div className="text-3xl font-extrabold text-[#6378ec] tracking-tight">
                          {analysisResult.prediction.bone_age_formatted}{" "}
                          <span className="text-sm font-semibold text-[#8c98ad]">
                            ({analysisResult.prediction.bone_age_months.toFixed(1)} mo)
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-[#f0f2f8] text-xs">
                          <div className="flex justify-between py-1">
                            <span className="text-[#8c98ad]">Chronological age:</span>
                            <span className="font-bold text-[#2a3650]">
                              {chronYears ? `${(parseFloat(chronYears) * 12).toFixed(1)} months` : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#8c98ad]">Age discrepancy:</span>
                            <span className="font-bold text-[#2a3650]">
                              {chronYears
                                ? `${(analysisResult.prediction.bone_age_months - parseFloat(chronYears) * 12).toFixed(1)} months`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#8c98ad]">Distribution std (σ):</span>
                            <span className="font-bold text-[#2a3650]">
                              ±{analysisResult.uncertainty.standard_deviation.toFixed(2)} months
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#8c98ad]">Distribution variance (σ²):</span>
                            <span className="font-bold text-[#2a3650]">
                              {analysisResult.uncertainty.variance.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Download Report Button */}
                        {currentAssessment?.id && (
                          <a
                            href={`/api/assessments/${currentAssessment.id}/report`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 w-full py-2 bg-[#f4f6ff] hover:bg-[#edf0ff] text-[#6378ec] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                          >
                            <Download className="w-3.5 h-3.5" /> Download PDF Report
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-[#9aa6bb]">
                        <FileText className="w-8 h-8 text-[#cbd4e5] mx-auto mb-2" />
                        Select an image and click "Estimate Bone Age" to display results.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 228-Bin Distribution & Region Contributions */}
              {analysisResult && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Probability Chart (7 cols) */}
                  <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-sm text-[#1e293b]">228-Bin Ordinal Probability Distribution</h3>
                        <p className="text-[11px] text-[#8c98ad]">Calibrated softmax probabilities over 1–228 months</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#edf0ff] text-[#6378ec]">
                        KL-Trained
                      </span>
                    </div>

                    <div className="h-44 w-full flex items-end gap-[1px] pt-4 px-1 border-b border-[#f0f2f8]">
                      {analysisResult.prediction.probability_distribution.map((prob: number, binIdx: number) => {
                        const month = binIdx + 1;
                        const maxP = Math.max(...analysisResult.prediction.probability_distribution, 0.01);
                        const hPct = Math.min(100, Math.max(2, (prob / maxP) * 100));
                        const isNearMean = Math.abs(month - analysisResult.prediction.bone_age_months) < 3;
                        return (
                          <div
                            key={binIdx}
                            style={{ height: `${hPct}%` }}
                            className={`flex-1 rounded-t-xs transition-all ${
                              isNearMean ? "bg-[#6378ec]" : "bg-[#c5d0f8]"
                            }`}
                            title={`Month ${month}: ${(prob * 100).toFixed(2)}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8c98ad] mt-2">
                      <span>1m</span>
                      <span>60m (5y)</span>
                      <span>120m (10y)</span>
                      <span>180m (15y)</span>
                      <span>228m (19y)</span>
                    </div>
                  </div>

                  {/* Region Contributions Table (5 cols) */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs overflow-hidden">
                    <h3 className="font-bold text-sm text-[#1e293b] mb-1">13 Ossification Regions</h3>
                    <p className="text-[11px] text-[#8c98ad] mb-3">GAT attention readout weights</p>

                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                            <th className="pb-2">Region</th>
                            <th className="pb-2 text-right">Attention</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f7f9fd]">
                          {ANATOMICAL_NAMES.map((name, idx) => {
                            const weight = analysisResult.readout_weights?.[String(idx)] ?? 0.07;
                            return (
                              <tr key={idx} className="hover:bg-[#fbfcfe]">
                                <td className="py-1.5 font-medium text-[#2d3a54]">{name}</td>
                                <td className="py-1.5 text-right font-bold text-[#6378ec]">
                                  {(weight * 100).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MODEL TRAINING */}
          {activeTab === "training" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-[#7e8a9f] uppercase tracking-wider">OSGA-Net / Training</div>
                  <h1 className="text-2xl font-extrabold text-[#1a253c] mt-1 tracking-tight">Two-Stage Model Training</h1>
                  <p className="text-xs text-[#8c98ad] mt-1">
                    Stage 1 (Landmark Heatmap Pretraining) & Stage 2 (Joint GAT/FiLM Fine-Tuning).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isTrainingActive && (
                    <button
                      onClick={() => setTrainConfigOpen(true)}
                      className="px-3.5 py-2 bg-[#6378ec] hover:bg-[#5267dc] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Training
                    </button>
                  )}
                  {isTrainingActive && (
                    <button
                      onClick={handlePauseTrain}
                      disabled={trainActionLoading}
                      className="px-3.5 py-2 bg-[#f4a261] hover:bg-[#e09151] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}
                  {trainState === "paused" && (
                    <button
                      onClick={handleResumeTrain}
                      disabled={trainActionLoading}
                      className="px-3.5 py-2 bg-[#20b9a9] hover:bg-[#189b8d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  {(isTrainingActive || trainState === "paused") && (
                    <button
                      onClick={handleStopTrain}
                      disabled={trainActionLoading}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Square className="w-3.5 h-3.5" /> Stop
                    </button>
                  )}
                </div>
              </div>

              {/* Training Config Modal */}
              {trainConfigOpen && (
                <div className="bg-white p-6 rounded-2xl border border-[#d8e0f5] shadow-lg space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-[#f0f2f8]">
                    <h3 className="font-bold text-sm text-[#1e293b]">Configure Two-Stage Training Run</h3>
                    <button onClick={() => setTrainConfigOpen(false)} className="text-xs text-[#8c98ad] hover:text-[#55637e]">
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#5e6c86] block mb-1">Stage 1 Epochs (Heatmaps)</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={trainEpochs1}
                        onChange={(e) => setTrainEpochs1(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#d8e0f2] bg-[#fbfcfe]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#5e6c86] block mb-1">Stage 2 Epochs (Joint)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={trainEpochs2}
                        onChange={(e) => setTrainEpochs2(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#d8e0f2] bg-[#fbfcfe]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#5e6c86] block mb-1">Batch Size</label>
                      <input
                        type="number"
                        min="1"
                        max="32"
                        value={trainBatchSize}
                        onChange={(e) => setTrainBatchSize(parseInt(e.target.value) || 2)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#d8e0f2] bg-[#fbfcfe]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setTrainConfigOpen(false)}
                      className="px-4 py-2 bg-white border border-[#d8e0f0] text-xs font-bold text-[#6b7994] rounded-xl hover:bg-[#f8faff]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStartTrain}
                      disabled={trainActionLoading}
                      className="px-4 py-2 bg-[#6378ec] hover:bg-[#5267dc] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      {trainActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Start Training Run
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Training KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Current Status</div>
                  <div className="text-xl font-extrabold text-[#1a253c] mt-2 capitalize flex items-center gap-2">
                    {trainState}
                    {isTrainingActive && <span className="w-2 h-2 rounded-full bg-[#6378ec] animate-ping" />}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">
                    Stage {trainingStatus?.stage || "—"} · Epoch {trainingStatus?.epoch || 0}/{trainingStatus?.total_epochs || 0}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Best Validation MAE</div>
                  <div className="text-xl font-extrabold text-[#33ad91] mt-2">
                    {trainingStatus?.best_mae ? `${trainingStatus.best_mae.toFixed(1)} mo` : "Pending"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">Evaluated against validation split</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Latest Train Loss</div>
                  <div className="text-xl font-extrabold text-[#1a253c] mt-2">
                    {trainingStatus?.last_train_loss ? trainingStatus.last_train_loss.toFixed(4) : "—"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">KL divergence + 0.3 heatmap MSE</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Active Checkpoint</div>
                  <div className="text-xl font-extrabold text-[#6378ec] mt-2 truncate">
                    {checkpoints?.checkpoints?.length ? "best.pt" : "None"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">
                    {checkpoints?.checkpoints?.length ? `${checkpoints.checkpoints.length} checkpoints saved` : "No weights on disk"}
                  </div>
                </div>
              </div>

              {/* Progress & Charts */}
              <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-[#1e293b]">Live Epoch Metrics Log</h3>
                    <p className="text-xs text-[#8c98ad]">Real loss and error metrics logged per epoch</p>
                  </div>
                  <button
                    onClick={() => {
                      refetchTrainingStatus();
                      refetchTrainingHistory();
                      refetchCheckpoints();
                    }}
                    className="p-1.5 rounded-lg border border-[#e2e7f4] text-[#78879e] hover:bg-[#f8faff]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {historyList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                          <th className="pb-2">Epoch</th>
                          <th className="pb-2">Stage</th>
                          <th className="pb-2">Train Loss</th>
                          <th className="pb-2">Val MAE (mo)</th>
                          <th className="pb-2">Val RMSE</th>
                          <th className="pb-2">Heatmap MSE</th>
                          <th className="pb-2">KL Loss</th>
                          <th className="pb-2 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f7f9fd]">
                        {historyList.map((h: any, i: number) => (
                          <tr key={i} className="hover:bg-[#fbfcfe]">
                            <td className="py-2 font-bold text-[#202d48]">{h.epoch}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  h.stage === 1 ? "bg-[#edf0ff] text-[#6378ec]" : "bg-[#e5f8f3] text-[#33ad91]"
                                }`}
                              >
                                Stage {h.stage}
                              </span>
                            </td>
                            <td className="py-2 font-mono text-[#2b3852]">{h.train_loss?.toFixed(4) || "—"}</td>
                            <td className="py-2 font-mono font-bold text-[#6378ec]">
                              {h.val_mae ? `${h.val_mae.toFixed(1)}m` : "—"}
                            </td>
                            <td className="py-2 font-mono text-[#78879e]">{h.val_rmse?.toFixed(1) || "—"}</td>
                            <td className="py-2 font-mono text-[#78879e]">{h.heatmap_mse?.toFixed(4) || "—"}</td>
                            <td className="py-2 font-mono text-[#78879e]">{h.kl_loss?.toFixed(4) || "—"}</td>
                            <td className="py-2 text-right text-[#9aa6bb]">{h.duration_sec ? `${h.duration_sec}s` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-[#9aa6bb]">
                    <Clock className="w-8 h-8 text-[#cbd4e5] mx-auto mb-2" />
                    No logged epochs yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EVALUATION */}
          {activeTab === "evaluation" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-[#7e8a9f] uppercase tracking-wider">OSGA-Net / Benchmarking</div>
                  <h1 className="text-2xl font-extrabold text-[#1a253c] mt-1 tracking-tight">Model Evaluation & Ablations</h1>
                  <p className="text-xs text-[#8c98ad] mt-1">
                    Evaluated against the held-out test and validation splits according to the IEEE protocol.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={evalSplit}
                    onChange={(e) => setEvalSplit(e.target.value as any)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#d8e0f2] bg-white text-[#55637e]"
                  >
                    <option value="val">Validation Split (1,425 / Sample)</option>
                    <option value="test">Held-Out Test Split (200 / Sample)</option>
                  </select>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Mean Absolute Error (MAE)</div>
                  <div className="text-2xl font-extrabold text-[#6378ec] mt-2">
                    {evaluationData?.overall?.mae ? `${evaluationData.overall.mae.toFixed(1)} mo` : "Pending"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">Average absolute prediction deviation</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Root Mean Square Error (RMSE)</div>
                  <div className="text-2xl font-extrabold text-[#a181ed] mt-2">
                    {evaluationData?.overall?.rmse ? `${evaluationData.overall.rmse.toFixed(1)} mo` : "Pending"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">Sensitivity to large outlier errors</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Within ±6 Months</div>
                  <div className="text-2xl font-extrabold text-[#33ad91] mt-2">
                    {evaluationData?.overall?.acc_6mo !== undefined
                      ? `${(evaluationData.overall.acc_6mo * 100).toFixed(1)}%`
                      : "Pending"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">Tight tolerance clinical accuracy</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <div className="text-xs font-bold text-[#7e8a9f]">Within ±12 Months</div>
                  <div className="text-2xl font-extrabold text-[#e9a15e] mt-2">
                    {evaluationData?.overall?.acc_12mo !== undefined
                      ? `${(evaluationData.overall.acc_12mo * 100).toFixed(1)}%`
                      : "Pending"}
                  </div>
                  <div className="text-[11px] text-[#8c98ad] mt-1">Broad tolerance clinical accuracy</div>
                </div>
              </div>

              {/* Table V Ablation Study & Literature Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ablations Table */}
                <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <h3 className="font-bold text-sm text-[#1e293b] mb-1">Ablation Study (Table V)</h3>
                  <p className="text-xs text-[#8c98ad] mb-4">Isolating each architectural component</p>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                        <th className="pb-2">Configuration</th>
                        <th className="pb-2 text-right">MAE (mo)</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f7f9fd]">
                      {[
                        { name: "Full OSGA-Net", key: "osga_full" },
                        { name: "− GAT (Averaged nodes)", key: "no_gat" },
                        { name: "− FiLM (Concatenation)", key: "no_film" },
                        { name: "− Ordinal Head (Scalar)", key: "no_ordinal" },
                        { name: "− Landmark Head (Grid)", key: "no_landmark" },
                      ].map((item, idx) => {
                        const row = ablationsData?.ablations?.find((x: any) => x.key === item.key);
                        return (
                          <tr key={idx} className="hover:bg-[#fbfcfe]">
                            <td className="py-2.5 font-bold text-[#2b3750]">{item.name}</td>
                            <td className="py-2.5 text-right font-mono text-[#6378ec]">
                              {row?.mae ? `${row.mae.toFixed(1)}m` : "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row?.status === "completed"
                                    ? "bg-[#e5f8f3] text-[#33ad91]"
                                    : "bg-[#fff4e8] text-[#db9a52]"
                                }`}
                              >
                                {row?.status === "completed" ? "Evaluated" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Literature Table */}
                <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <h3 className="font-bold text-sm text-[#1e293b] mb-1">Literature Benchmarks (Table IV)</h3>
                  <p className="text-xs text-[#8c98ad] mb-4">Published RSNA Pediatric Bone Age test set results</p>

                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                          <th className="pb-2">Method</th>
                          <th className="pb-2">Year</th>
                          <th className="pb-2 text-right">MAE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f7f9fd]">
                        {(literatureData?.entries || []).map((lit: any, idx: number) => (
                          <tr key={idx} className={lit.is_proposed_model ? "bg-[#f4f6ff] font-bold" : "hover:bg-[#fbfcfe]"}>
                            <td className="py-2 text-[#2b3750]">
                              {lit.method}
                              {lit.is_proposed_model && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#6378ec] text-white text-[9px]">
                                  Ours
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-[#8c98ad]">{lit.year}</td>
                            <td className="py-2 text-right font-mono text-[#6378ec]">
                              {lit.mae ? `${lit.mae.toFixed(2)}m` : "Pending"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ARCHITECTURE */}
          {activeTab === "architecture" && (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-bold text-[#7e8a9f] uppercase tracking-wider">OSGA-Net / Design</div>
                <h1 className="text-2xl font-extrabold text-[#1a253c] mt-1 tracking-tight">Technical Architecture & Specs</h1>
                <p className="text-xs text-[#8c98ad] mt-1">
                  Full mathematical specifications, tensor dimensions, and anatomical adjacency graph.
                </p>
              </div>

              {/* Pipeline Step Flow */}
              <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                <h3 className="font-bold text-sm text-[#1e293b] mb-4">Forward Inference Flow</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  {[
                    { title: "Input Radiograph", shape: "1 × 384 × 384", desc: "Grayscale + CLAHE" },
                    { title: "EfficientNetV2-S", shape: "1280 × 12 × 12", desc: "Shared CNN trunk" },
                    { title: "Landmark Head", shape: "13 × 48 × 48", desc: "Soft-argmax coords" },
                    { title: "RoIAlign & FiLM", shape: "13 × 1280", desc: "Per-node γ, β scale/shift" },
                    { title: "2-Layer GAT", shape: "13 × 1024", desc: "4 attention heads" },
                    { title: "Ordinal Head", shape: "228 probabilities", desc: "Expectation + σ²" },
                  ].map((st, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[#f8faff] border border-[#e2e7f4] text-center">
                      <div className="text-xs font-bold text-[#142042]">{st.title}</div>
                      <div className="font-mono text-[11px] font-bold text-[#6378ec] mt-1">{st.shape}</div>
                      <div className="text-[10px] text-[#8c98ad] mt-1">{st.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tensor Shapes Table (Table X) & Adjacency (Table IX) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <h3 className="font-bold text-sm text-[#1e293b] mb-1">Tensor Shapes (Table X)</h3>
                  <p className="text-xs text-[#8c98ad] mb-4">Pipeline dimensional flow</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                        <th className="pb-2">Stage</th>
                        <th className="pb-2 text-right">Output Shape</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f7f9fd]">
                      {[
                        ["Input radiograph", "1 × 384 × 384"],
                        ["Backbone feature map F", "1280 × 12 × 12"],
                        ["Landmark heatmaps H", "13 × 48 × 48"],
                        ["Node features v_r", "1280 (13 nodes)"],
                        ["FiLM γ, β parameters", "1280 per node"],
                        ["GAT hidden (per head)", "256 (4 heads)"],
                        ["GAT output (concat)", "1024"],
                        ["Graph readout g", "1024"],
                        ["Output distribution p_pred", "228 monthly bins"],
                      ].map(([stg, shp], idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-[#2d3a54]">{stg}</td>
                          <td className="py-2 text-right font-mono font-bold text-[#6378ec]">{shp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#e9edf5] shadow-xs">
                  <h3 className="font-bold text-sm text-[#1e293b] mb-1">Anatomical Adjacency (Table IX)</h3>
                  <p className="text-xs text-[#8c98ad] mb-4">Clinical skeletal graph topology</p>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-bold text-[#8c98ad] uppercase border-b border-[#f0f2f8]">
                          <th className="pb-2">Node A</th>
                          <th className="pb-2 text-right">Node B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f7f9fd]">
                        {[
                          ["Distal radius", "Carpal cluster (radial side)"],
                          ["Distal ulna", "Carpal cluster (ulnar side)"],
                          ["Carpal cluster (radial)", "Metacarpal I & II"],
                          ["Carpal cluster (ulnar)", "Metacarpal IV & V"],
                          ["Metacarpal I", "Phalanx (thumb)"],
                          ["Metacarpal II", "Phalanx (index, proximal)"],
                          ["Metacarpal III", "Phalanx (middle, proximal)"],
                          ["Metacarpal IV", "Phalanx (ring, proximal)"],
                          ["Metacarpal V", "Phalanx (little, proximal)"],
                          ["Phalanx (index, proximal)", "Phalanx (middle, proximal) [Cross-ray]"],
                        ].map(([na, nb], idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-medium text-[#2d3a54]">{na}</td>
                            <td className="py-2 text-right font-medium text-[#6378ec]">{nb}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-8 py-4 border-t border-[#e9edf5] text-[11px] text-[#97a3b8] flex justify-between items-center bg-white">
          <span>OSGA-Net Research Workstation · Academic Prototype · Not for Autonomous Clinical Diagnosis</span>
          <span>RSNA Pediatric Bone Age Benchmark</span>
        </footer>
      </div>
    </div>
  );
};
