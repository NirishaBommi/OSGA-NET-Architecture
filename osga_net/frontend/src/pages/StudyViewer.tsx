import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Share2,
  Box,
  Layers,
  ShieldAlert,
} from "lucide-react";

import { fetchAssessment, fetchAssessmentResults, fetchModelStatus, runInference, runDemoInference } from "../services/api";
import { ImageViewer } from "../components/ImageViewer";

export const StudyViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [runningAction, setRunningAction] = useState<boolean>(false);

  const { data: assessment, refetch: refetchAssessment } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => fetchAssessment(id!),
    enabled: !!id,
  });

  const { data: result, refetch: refetchResults } = useQuery({
    queryKey: ["assessmentResults", id],
    queryFn: () => fetchAssessmentResults(id!),
    enabled: !!id && assessment?.status === "completed",
  });

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  const handleRunInference = async (isDemo = false) => {
    if (!id) return;
    setRunningAction(true);
    try {
      if (isDemo) {
        await runDemoInference(id);
      } else {
        await runInference(id);
      }
      await refetchAssessment();
      await refetchResults();
    } catch (err: any) {
      alert(err.message || "Execution failed");
    } finally {
      setRunningAction(false);
    }
  };

  const imageSrc = assessment?.image_filename ? `/api/assessments/${id}/image-file` : "";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-3 gap-3">
      {/* Top Breadcrumb Bar */}
      <div className="h-9 px-3 bg-navy-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-300 select-none flex-shrink-0">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="hover:text-white transition-colors">
            Studies
          </Link>
          <span className="text-slate-600">/</span>
          <span className="font-mono text-sky-400 font-medium">{id}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{assessment?.title || "Untitled"}</span>
        </div>

        <div className="flex items-center gap-3">
          {result && (
            <span
              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-medium ${
                result.result_source === "real_inference"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-amber-950 text-amber-400 border border-amber-800"
              }`}
            >
              {result.result_source === "real_inference" ? "Real Inference" : "Demonstration"}
            </span>
          )}
          {assessment?.status === "completed" && (
            <a
              href={`/api/assessments/${id}/report`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Report</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Workspace Split View */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
        {/* Left: Imaging Canvas */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
          {imageSrc ? (
            <ImageViewer
              imageSrc={imageSrc}
              imageWidth={assessment?.image_original_width || 512}
              imageHeight={assessment?.image_original_height || 512}
              landmarks={result?.landmarks || []}
              nodeWeights={result?.readout_weights || {}}
              regions={result?.regions || null}
              edges={result?.graph?.edges || []}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-slate-500 text-xs">
              No radiograph uploaded for this study.
            </div>
          )}
        </div>

        {/* Right: Quick Assessment Card & Deep Dive Navigator */}
        <div className="w-full lg:w-80 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">
          {/* Assessment State Banner if not completed */}
          {assessment && assessment.status !== "completed" && (
            <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Evaluation Pending</span>
              </div>
              <p className="text-xs text-slate-400">
                Radiograph uploaded. Select inference mode to compute skeletal maturity.
              </p>
              {status?.checkpoint_loaded ? (
                <button
                  onClick={() => handleRunInference(false)}
                  disabled={runningAction}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{runningAction ? "Evaluating..." : "Run Real Inference"}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleRunInference(true)}
                  disabled={runningAction}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{runningAction ? "Generating..." : "Run Demonstration"}</span>
                </button>
              )}
            </div>
          )}

          {/* Results Summary Card */}
          {result && (
            <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estimated Bone Age</span>
                <span className="text-[10px] font-mono text-slate-500">{result.timing_ms} ms</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sky-400">{result.prediction.bone_age_formatted}</span>
                <span className="text-xs text-slate-400">({result.prediction.bone_age_months.toFixed(1)} mo)</span>
              </div>

              {/* Uncertainty & Triage Status */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Model Uncertainty (σ):</span>
                  <span className="font-mono text-slate-200">±{result.uncertainty.standard_deviation.toFixed(2)} mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">95% Mass Interval:</span>
                  <span className="font-mono text-slate-200">
                    {result.uncertainty.central_95_mass_interval_months[0].toFixed(0)} – {result.uncertainty.central_95_mass_interval_months[1].toFixed(0)} mo
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400">Triage Flag:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      result.uncertainty.needs_review
                        ? "bg-amber-950 text-amber-400 border border-amber-800"
                        : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    }`}
                  >
                    {result.uncertainty.needs_review ? "NEEDS REVIEW" : "NORMAL OPERATING RANGE"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 13 Anatomical Centers Attention Readout List */}
          {result && (
            <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-2 flex-1">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Readout Node Attention
                </span>
                <span className="text-[10px] text-slate-500">13 Centers</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {result.landmarks.map((lm) => {
                  const weight = result.readout_weights[lm.name] || 0;
                  const isSelected = selectedNodeId === lm.node_id;
                  return (
                    <div
                      key={lm.node_id}
                      onClick={() => setSelectedNodeId(lm.node_id)}
                      className={`p-1.5 rounded cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        isSelected ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "hover:bg-slate-800/60 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 text-[10px] font-mono text-slate-500">{lm.node_id}</span>
                        <span className="truncate">{lm.name.replace("_", " ")}</span>
                      </div>
                      <span className="font-mono text-[11px] text-sky-400 font-medium">
                        {(weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Deep-Dive Links */}
          {id && (
            <div className="p-3 rounded-xl bg-navy-900 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block px-1">
                Deep Dive Inspectors
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <Link
                  to={`/assessments/${id}/landmarks`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Landmarks</span>
                </Link>
                <Link
                  to={`/assessments/${id}/regions`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <Box className="w-3.5 h-3.5 text-sky-400" />
                  <span>RoI Boxes</span>
                </Link>
                <Link
                  to={`/assessments/${id}/film`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>FiLM Fusion</span>
                </Link>
                <Link
                  to={`/assessments/${id}/graph`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <Share2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>GAT Graph</span>
                </Link>
                <Link
                  to={`/assessments/${id}/prediction`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>228 Bins</span>
                </Link>
                <Link
                  to={`/assessments/${id}/uncertainty`}
                  className="p-2 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors border border-slate-800/80"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Uncertainty</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
