import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  FileText,
  BarChart3,
  Crosshair,
  Info,
  RefreshCw,
  Trash2,
  Sparkles,
  Loader2,
  Download,
  Share2,
  Layers,
  ChevronRight,
  ExternalLink,
  Presentation,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import {
  directAssess,
  fetchModelStatus,
  fetchLiterature,
  fetchAblations,
} from "../services/api";
import {
  Assessment,
  PredictionResult,
  LandmarkCoord,
  LiteratureEntry,
  AblationRow,
} from "../types";

export const MedicalDashboard: React.FC = () => {
  // Navigation Tabs: 1. Assess a radiograph | 2. Results (Tables IV & V) | 3. Method & scope
  const [activeTab, setActiveTab] = useState<"assess" | "results" | "method">("assess");

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [patientSex, setPatientSex] = useState<"male" | "female">("male");
  const [chronologicalYears, setChronologicalYears] = useState<number | string>("0");

  // Assessment Execution State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Queries for background data
  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  const { data: literature } = useQuery({
    queryKey: ["literature"],
    queryFn: fetchLiterature,
  });

  const { data: ablations } = useQuery({
    queryKey: ["ablations"],
    queryFn: () => fetchAblations("val"),
  });

  // Handle Image File Selection
  const handleFileChange = (file: File) => {
    setError(null);
    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  };

  // Quick Load Sample Radiograph
  const handleLoadSample = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/sample_hand.png");
      if (!res.ok) throw new Error("Could not load sample image file");
      const blob = await res.blob();
      const file = new File([blob], "sample_pediatric_hand.png", { type: "image/png" });
      handleFileChange(file);
      setChronologicalYears("11.5");
      setPatientSex("male");
    } catch (e: any) {
      setError(e.message || "Failed to load sample radiograph");
    } finally {
      setLoading(false);
    }
  };

  // Run Inference / Assessment
  const handleEstimateBoneAge = async () => {
    if (!selectedFile) {
      setError("Please select or drop a left-hand radiograph first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const chronNum = parseFloat(String(chronologicalYears));
      const validChron = !isNaN(chronNum) && chronNum > 0 ? chronNum : null;

      const directRes = await directAssess({
        file: selectedFile,
        sex: patientSex,
        chron_years: validChron,
      });

      setCurrentAssessment(directRes.assessment);
      setResult(directRes.result);
    } catch (err: any) {
      setError(err.message || "Bone age evaluation failed. Please verify the image file.");
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageDimensions(null);
    setCurrentAssessment(null);
    setResult(null);
    setError(null);
  };

  const isDemo = result?.result_source === "demonstration";

  // Compute Top Age Bins for chart visualization
  const topBinsData = React.useMemo(() => {
    if (!result || !result.prediction.probability_distribution) return [];
    const dist = result.prediction.probability_distribution;
    const centerMonth = Math.round(result.prediction.bone_age_months);

    // Group into 6-month resolution bins around the estimated age
    const offsets = [-18, -12, -6, 0, 6, 12, 18];
    return offsets.map((off) => {
      const m = Math.max(1, Math.min(228, centerMonth + off));
      const val = dist[m - 1] || 0;
      const years = (m / 12).toFixed(1);
      return {
        age: `${years} y`,
        prob: Number((val * 100).toFixed(1)),
        isPeak: off === 0,
        rawMonths: m,
      };
    });
  }, [result]);

  // Compute Region Contributions table
  const regionTableData = React.useMemo(() => {
    if (!result || !result.readout_weights) return [];
    const weights = result.readout_weights;
    return Object.entries(weights)
      .map(([name, weight], idx) => ({
        id: idx + 1,
        name: name.replace(/_/g, " ").toUpperCase(),
        rawName: name,
        weight: Number(weight),
        score: (Number(weight) * 100).toFixed(1) + "%",
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#062F32] via-[#072F34] to-[#082C35] text-slate-100 font-sans p-4 md:p-8 flex flex-col justify-between selection:bg-[#20B9A9] selection:text-slate-900">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* 1. HEADER SECTION */}
        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <span>OSGA-Net · Bone Age Assessment</span>
                {status && (
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                      status.checkpoint_present
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {status.mode.replace("_", " ")}
                  </span>
                )}
              </h1>
              <p className="text-xs md:text-sm text-[#A1E3DB]/90 font-normal mt-0.5">
                Ossification-Structure Graph Attention Network · 13 regions · per-node FiLM · GAT · calibrated age distribution.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/presentation"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20B9A9]/20 hover:bg-[#20B9A9]/30 text-[#20B9A9] border border-[#20B9A9]/40 text-xs font-semibold transition-colors"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>Presentation Tour</span>
              </Link>
              <Link
                to="/workstation"
                className="text-xs text-slate-300 hover:text-white underline hidden sm:inline"
              >
                Advanced Workstation
              </Link>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-[#2D1E0C]/90 border border-amber-600/70 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-amber-200 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong className="text-amber-300 font-semibold">⚠ Research prototype</strong> – NOT a medical device and not validated for clinical use. Any estimate must be reviewed by a qualified radiologist.
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-[#0D4447] flex items-center gap-8 pt-2">
            <button
              onClick={() => setActiveTab("assess")}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === "assess" ? "text-[#20B9A9]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Assess a radiograph
              {activeTab === "assess" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#20B9A9] shadow-[0_0_8px_#20B9A9]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("results")}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === "results" ? "text-[#20B9A9]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Results (Tables IV & V)
              {activeTab === "results" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#20B9A9] shadow-[0_0_8px_#20B9A9]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("method")}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === "method" ? "text-[#20B9A9]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Method & scope
              {activeTab === "method" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#20B9A9] shadow-[0_0_8px_#20B9A9]" />
              )}
            </button>
          </div>
        </header>

        {/* 2. TAB CONTENT 1: ASSESS A RADIOGRAPH */}
        {activeTab === "assess" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: Upload & Patient Info */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Card 1: Radiograph Upload */}
              <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 p-5 flex flex-col">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs tracking-wide self-start mb-4 shadow-sm">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Left-hand radiograph (de-identified)</span>
                </div>

                {!previewUrl ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileChange(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-[#20B9A9] bg-[#20B9A9]/10"
                        : "border-slate-300 hover:border-[#20B9A9] bg-white/70"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-[#E2F8F5] flex items-center justify-center text-[#20B9A9] mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#20B9A9]">Drop Image Here</p>
                    <p className="text-xs text-slate-400 my-1">- or -</p>
                    <button
                      type="button"
                      className="text-xs font-bold text-[#20B9A9] hover:underline"
                    >
                      Click to Upload
                    </button>
                    <p className="text-[11px] text-slate-400 mt-3">Supports JPG, JPEG, PNG (de-identified)</p>

                    <div className="mt-4 pt-3 border-t border-slate-200/80 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSample();
                        }}
                        className="text-xs text-[#062F32] font-semibold bg-[#B8F5E9] hover:bg-[#a0f2e2] px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 mx-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#20B9A9]" />
                        <span>Load sample pediatric radiograph</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center border border-slate-300 shadow-inner">
                      <img
                        src={previewUrl}
                        alt="Radiograph Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span>
                        {selectedFile?.name}{" "}
                        {imageDimensions && `(${imageDimensions.width} × ${imageDimensions.height} px)`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#20B9A9] hover:underline flex items-center gap-1 font-medium"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                        </button>
                        <button
                          onClick={clearImage}
                          className="text-rose-500 hover:underline flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Patient Information */}
              <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 p-5 space-y-4">
                {/* Sex Input */}
                <div>
                  <div className="inline-flex items-center px-3 py-1 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs mb-2">
                    Sex
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPatientSex("male")}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 border transition-all ${
                        patientSex === "male"
                          ? "bg-[#20B9A9] text-[#062F32] border-[#20B9A9] shadow-sm font-bold"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${patientSex === "male" ? "bg-[#062F32]" : "border border-slate-400"}`} />
                      <span>Male</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPatientSex("female")}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 border transition-all ${
                        patientSex === "female"
                          ? "bg-[#20B9A9] text-[#062F32] border-[#20B9A9] shadow-sm font-bold"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${patientSex === "female" ? "bg-[#062F32]" : "border border-slate-400"}`} />
                      <span>Female</span>
                    </button>
                  </div>
                </div>

                {/* Chronological Age Input */}
                <div>
                  <div className="inline-flex items-center px-3 py-1 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs mb-2">
                    Chronological age in years (optional - used only if the model was trained with it)
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="22"
                    value={chronologicalYears}
                    onChange={(e) => setChronologicalYears(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#20B9A9] focus:ring-1 focus:ring-[#20B9A9]"
                  />
                </div>
              </div>

              {/* Assessment Action Button */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleEstimateBoneAge}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-[#20B9A9] hover:bg-[#1AA899] text-[#062F32] font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#20B9A9]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Evaluating ossification structures...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Estimate bone age</span>
                  </>
                )}
              </button>
            </div>

            {/* RIGHT COLUMN: Detected Regions & Visualizations */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Card: Detected Ossification Regions */}
              <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 p-5 flex flex-col">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs tracking-wide self-start mb-3 shadow-sm">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Detected ossification regions (circle size = attention weight)</span>
                </div>

                {/* Radiograph Visualization Canvas */}
                <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-300 min-h-[380px] flex items-center justify-center">
                  {previewUrl ? (
                    <div className="relative w-full h-full max-h-[460px] flex items-center justify-center bg-black">
                      <img
                        src={previewUrl}
                        alt="Radiograph with Overlays"
                        className="max-h-[460px] w-auto object-contain select-none"
                      />

                      {/* 13 Landmark Overlays */}
                      {result?.landmarks && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                          {result.landmarks.map((lm: LandmarkCoord, idx: number) => {
                            const weight = result.readout_weights?.[lm.name] || 0.05;
                            // Scale circle radius proportional to attention weight
                            const radius = Math.max(12, Math.min(36, 12 + weight * 120));
                            const isHovered = hoveredNodeId === lm.node_id;

                            // Coordinates are normalized 0..1 in padded square
                            const cx = `${lm.x_norm * 100}%`;
                            const cy = `${lm.y_norm * 100}%`;

                            return (
                              <g
                                key={lm.node_id}
                                onMouseEnter={() => setHoveredNodeId(lm.node_id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                className="cursor-pointer transition-all duration-200"
                              >
                                {/* Outer Attention Circle */}
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={radius}
                                  fill="#20B9A9"
                                  fillOpacity={isHovered ? 0.45 : 0.25}
                                  stroke="#20B9A9"
                                  strokeWidth={isHovered ? 3 : 1.8}
                                  className={isHovered ? "filter drop-shadow-[0_0_8px_#20B9A9]" : ""}
                                />
                                {/* Center Anchor */}
                                <circle cx={cx} cy={cy} r={3} fill="#FFFFFF" stroke="#062F32" strokeWidth={1} />
                                {/* Node Label */}
                                <text
                                  x={cx}
                                  y={cy}
                                  dy={-radius - 4}
                                  textAnchor="middle"
                                  fill="#FFFFFF"
                                  fontSize="9px"
                                  fontWeight="bold"
                                  className="pointer-events-none drop-shadow"
                                >
                                  {idx}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}

                      {/* Hover Info Tooltip */}
                      {hoveredNodeId !== null && result?.landmarks && (
                        <div className="absolute bottom-3 left-3 bg-[#062F32]/95 text-white border border-[#20B9A9] rounded-lg p-2.5 text-xs shadow-xl pointer-events-none z-20">
                          <p className="font-bold text-[#20B9A9]">
                            {result.landmarks[hoveredNodeId]?.name.replace(/_/g, " ").toUpperCase()} (Node {hoveredNodeId})
                          </p>
                          <p className="text-[11px] text-slate-300">
                            Attention Weight:{" "}
                            {(
                              (result.readout_weights?.[result.landmarks[hoveredNodeId]?.name] || 0) * 100
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-2 text-slate-400">
                      <ImageIcon className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs">No radiograph evaluated yet.</p>
                      <p className="text-[11px] text-slate-500">
                        Upload a radiograph on the left and click "Estimate bone age" to detect the 13 ossification regions.
                      </p>
                    </div>
                  )}
                </div>

                {/* Canvas Legend */}
                {result && (
                  <div className="mt-3 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#20B9A9]/30 border border-[#20B9A9] inline-block" />
                      <span>Circle diameter proportional to GAT attention weight</span>
                    </div>
                    {isDemo && (
                      <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Demonstration output
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-cards: Top Age Bins & Region Contributions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Sub-card 1: Top Age Bins */}
                <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 p-4 flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs mb-3">
                      Top age bins
                    </div>

                    {result ? (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topBinsData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <XAxis dataKey="age" tick={{ fontSize: 10, fill: "#64748B" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#64748B" }} unit="%" />
                            <Tooltip
                              formatter={(value: any) => [`${value}% probability`, "Likelihood"]}
                              labelFormatter={(label) => `Age Bin: ${label}`}
                              contentStyle={{ backgroundColor: "#062F32", borderColor: "#20B9A9", fontSize: "11px", color: "#fff" }}
                            />
                            <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
                              {topBinsData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.isPeak ? "#20B9A9" : "#94A3B8"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                        <span>Awaiting inference output</span>
                      </div>
                    )}
                  </div>

                  {result && (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span>Expected Bone Age:</span>
                      <strong className="text-[#062F32] font-bold">{result.prediction.bone_age_formatted}</strong>
                    </div>
                  )}
                </div>

                {/* Sub-card 2: Region Contributions */}
                <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 p-4 flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#B8F5E9] text-[#062F32] font-semibold text-xs mb-3">
                      Region contributions
                    </div>

                    {result ? (
                      <div className="overflow-x-auto max-h-44">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase">
                              <th className="pb-1">#</th>
                              <th className="pb-1">Anatomical Region</th>
                              <th className="pb-1 text-right">Attention</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {regionTableData.slice(0, 5).map((row) => (
                              <tr key={row.id} className="hover:bg-slate-100/60">
                                <td className="py-1 text-[#20B9A9] font-bold">{row.id}</td>
                                <td className="py-1 font-sans text-slate-700 truncate max-w-[130px]" title={row.name}>
                                  {row.name}
                                </td>
                                <td className="py-1 text-right font-semibold text-[#062F32]">{row.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-36 flex flex-col justify-center">
                        <div className="grid grid-cols-3 text-center border-b border-slate-200 pb-1 text-xs font-semibold text-slate-400">
                          <div>1</div>
                          <div>2</div>
                          <div>3</div>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-6">Awaiting region analysis</p>
                      </div>
                    )}
                  </div>

                  {result && (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span>Top ossification contributor:</span>
                      <strong className="text-[#062F32] font-bold truncate max-w-[140px]">
                        {regionTableData[0]?.name || "N/A"}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB CONTENT 2: RESULTS (TABLES IV & V) */}
        {activeTab === "results" && (
          <div className="space-y-6">
            {/* Clinical Assessment Summary Card */}
            {result ? (
              <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-xs uppercase font-mono tracking-wider text-slate-500">Clinical Assessment Result</span>
                    <h2 className="text-3xl font-extrabold text-[#062F32] tracking-tight mt-0.5">
                      {result.prediction.bone_age_formatted}
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        ({result.prediction.bone_age_months.toFixed(1)} months)
                      </span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/assessments/${currentAssessment?.id}/report`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#20B9A9] hover:bg-[#1AA899] text-[#062F32] font-bold text-xs transition-colors shadow"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Clinical PDF Report</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Predictive Dispersion (σ)</span>
                    <p className="text-lg font-bold text-slate-800 mt-1">{result.uncertainty.standard_deviation.toFixed(1)} mo</p>
                    <p className="text-[11px] text-slate-500">Uncertainty standard deviation</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Central 95% Mass Interval</span>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {result.uncertainty.central_95_mass_interval_months[0].toFixed(0)} – {result.uncertainty.central_95_mass_interval_months[1].toFixed(0)} mo
                    </p>
                    <p className="text-[11px] text-slate-500">Model predicted interval</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Radiologist Triage</span>
                    <p className={`text-lg font-bold mt-1 ${result.uncertainty.needs_review ? "text-rose-600" : "text-emerald-600"}`}>
                      {result.uncertainty.needs_review ? "Audit Recommended" : "Standard Range"}
                    </p>
                    <p className="text-[11px] text-slate-500">Operating point threshold</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Data Provenance</span>
                    <p className={`text-lg font-bold mt-1 ${isDemo ? "text-amber-600" : "text-emerald-600"}`}>
                      {isDemo ? "Demonstration" : "Live Model"}
                    </p>
                    <p className="text-[11px] text-slate-500">Strict zero-fabrication badge</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl p-6 text-center border border-slate-200">
                <Info className="w-8 h-8 text-[#20B9A9] mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No Assessment Run in Current Session</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Upload a hand radiograph in the "Assess a radiograph" tab to view specific patient predictions, age distributions, and downloadable reports.
                </p>
              </div>
            )}

            {/* Table IV: Literature Comparison */}
            <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#062F32]">Table IV · Literature Comparison (Published Benchmarks)</h3>
                  <p className="text-xs text-slate-500">Published peer-reviewed results on RSNA Pediatric Bone Age challenge.</p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">RSNA 2017</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Year</th>
                      <th className="py-2.5 px-3">Reference / Citation</th>
                      <th className="py-2.5 px-3 text-right">MAE (months)</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {literature?.entries.map((m: LiteratureEntry, idx: number) => (
                      <tr key={idx} className={m.is_proposed_model ? "bg-[#B8F5E9]/40 font-semibold" : "hover:bg-slate-100/50"}>
                        <td className="py-2.5 px-3">
                          <span className={m.is_proposed_model ? "text-[#062F32] font-bold" : "text-slate-800"}>{m.method}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{m.year}</td>
                        <td className="py-2.5 px-3 text-slate-600">{m.reference}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#062F32]">
                          {m.mae !== null ? m.mae.toFixed(2) : "Pending"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            m.is_proposed_model ? "bg-[#20B9A9] text-[#062F32]" : "bg-slate-200 text-slate-700"
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table V: Ablation Matrix */}
            <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#062F32]">Table V · Ablation Study Matrix</h3>
                  <p className="text-xs text-slate-500">Evaluation of isolated structural components across 8 model variants.</p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">Validation Split</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                      <th className="py-2.5 px-3">Variant Key</th>
                      <th className="py-2.5 px-3">Component / Name</th>
                      <th className="py-2.5 px-3 text-right">MAE</th>
                      <th className="py-2.5 px-3 text-right">RMSE</th>
                      <th className="py-2.5 px-3 text-right">Acc ≤ 6mo</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {[...(ablations?.ablations || []), ...(ablations?.baselines || [])].map((v: AblationRow) => (
                      <tr key={v.key} className={v.key === "osga_full" ? "bg-[#B8F5E9]/40 font-semibold" : "hover:bg-slate-100/50"}>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#062F32]">{v.key}</td>
                        <td className="py-2.5 px-3 text-slate-600">{v.label}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#062F32]">
                          {v.mae !== null ? v.mae.toFixed(2) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {v.rmse !== null ? v.rmse.toFixed(2) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {v.acc6 !== null ? `${v.acc6.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            v.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                          }`}>
                            {v.status === "completed" ? "Evaluated" : "Evaluation pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. TAB CONTENT 3: METHOD & SCOPE */}
        {activeTab === "method" && (
          <div className="space-y-6">
            <div className="bg-[#F2F4F5] text-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#062F32]">The OSGA-Net Architecture</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Structure-Aware Pediatric Bone Age Assessment via Anatomical Graph Attention and Demographic Modulation.
                </p>
              </div>

              {/* 6 Stage Technical Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">Heatmap Landmark Head</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Predicts 13 spatial heatmaps at stride 8 (48×48 for 384 input) with differentiable soft-argmax coordinate extraction to anchor on true growth centers.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">RoIAlign Epiphyseal Pooling</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Detached coordinates define local 2×2 bounding boxes around each ossification center, isolating localized growth plate maturation features.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">Per-Node FiLM Modulation</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Feature-wise Linear Modulation (x' = (1 + γ) ⊙ x + β) incorporates biological sex and age without disrupting the spatial graph topology.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    04
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">2-Layer Dense GAT</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Computes multi-head relational attention across 20 anatomical skeletal edges, capturing inter-bone maturation dependencies.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    05
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">228-Bin Ordinal Distribution</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Discrete probability distribution over months 1 to 228 trained with KL divergence on soft Gaussian targets, providing natural uncertainty estimates.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E2F8F5] text-[#20B9A9] flex items-center justify-center font-bold text-xs">
                    06
                  </div>
                  <h3 className="text-sm font-bold text-[#062F32]">Uncertainty & Triage</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Standard deviation σ tracks predictive dispersion. Cases exceeding the 90th percentile threshold derived from validation calibration are automatically flagged.
                  </p>
                </div>
              </div>

              {/* Research Scope & Transparency Notice */}
              <div className="p-5 rounded-xl bg-[#E2F8F5]/60 border border-[#20B9A9]/30 space-y-2 text-xs text-slate-700">
                <h4 className="font-bold text-[#062F32] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#20B9A9]" />
                  <span>Academic Integrity & Dataset Disclosures</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>
                    <strong>Landmark Supervision:</strong> RSNA contains no ground truth coordinates; training relies on classical-CV heuristics (weak template), manual CSV annotations, or unsupervised joint training.
                  </li>
                  <li>
                    <strong>Chronological Age:</strong> Public RSNA data omits chronological age; FiLM operates primarily on biological sex unless external age metadata is added.
                  </li>
                  <li>
                    <strong>Scientific Honesty:</strong> No placeholder or synthetic numbers are presented as empirical evaluations. Missing checkpoints display explicit integration pending states.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. FOOTER */}
      <footer className="mt-8 pt-4 border-t border-[#0D4447] text-center text-xs text-slate-400">
        <p>OSGA-Net Research Prototype · Structure-Aware Bone Age Assessment · For academic and educational demonstration only.</p>
      </footer>
    </div>
  );
};
