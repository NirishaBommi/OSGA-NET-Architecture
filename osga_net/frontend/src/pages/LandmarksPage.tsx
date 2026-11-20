import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Eye, Info, CheckCircle2 } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults, fetchModelStatus } from "../services/api";

export const LandmarksPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedNodeId, setSelectedNodeId] = useState<number>(0);

  const { data: assessment } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => fetchAssessment(id!),
    enabled: !!id,
  });

  const { data: result } = useQuery({
    queryKey: ["assessmentResults", id],
    queryFn: () => fetchAssessmentResults(id!),
    enabled: !!id,
  });

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  const landmarks = result?.landmarks || [];
  const selectedLm = landmarks.find((l) => l.node_id === selectedNodeId) || landmarks[0];
  const weight = result && selectedLm ? result.readout_weights[selectedLm.name] : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-amber-400">Landmarks & Heatmaps</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">13 Anatomical Landmarks & Heatmaps</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Auxiliary landmark localization head with differentiable soft-argmax coordinate extraction.
          </p>
        </div>
        <Link
          to={`/assessments/${id}/viewer`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
        >
          <Eye className="w-4 h-4 text-sky-400" />
          <span>Return to Workspace</span>
        </Link>
      </div>

      {/* Supervision Truthfulness Notice */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 font-medium">Dataset Supervision Protocol:</strong> RSNA Pediatric Bone Age challenge files contain no landmark ground-truth annotations. The landmark head was supervised via{" "}
          <code className="text-sky-300 font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
            {status?.landmark_source || "template"}
          </code>{" "}
          supervision (Otsu hand segmentation bounding box mapped to a classical anatomical hand template), trained with soft Gaussian heatmaps at stride 8.
        </div>
      </div>

      {/* Interactive Landmark Grid & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of 13 Nodes */}
        <div className="lg:col-span-2 rounded-xl bg-navy-900 border border-slate-800 overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Anatomical Landmark Coordinates</span>
            <span className="text-slate-500 font-mono">13 Nodes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Anatomical Center</th>
                  <th className="py-2.5 px-3 font-mono">Square (x, y)</th>
                  <th className="py-2.5 px-3 font-mono">Original Image (px)</th>
                  <th className="py-2.5 px-3 text-right">Readout Wt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {landmarks.map((lm) => {
                  const isSelected = selectedNodeId === lm.node_id;
                  const w_val = result?.readout_weights[lm.name] || 0;
                  return (
                    <tr
                      key={lm.node_id}
                      onClick={() => setSelectedNodeId(lm.node_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-sky-500/15 text-sky-300" : "hover:bg-slate-900/50 text-slate-300"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-sky-400">{lm.node_id}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200 truncate">
                        {lm.name.replace(/_/g, " ").toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        ({lm.x_norm.toFixed(3)}, {lm.y_norm.toFixed(3)})
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {Math.round(lm.x_orig_px)}, {Math.round(lm.y_orig_px)} px
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-sky-400">
                        {(w_val * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Node Details Card */}
        {selectedLm && (
          <div className="rounded-xl bg-navy-900 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider block">Node #{selectedLm.node_id}</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{selectedLm.name.replace("_", " ").toUpperCase()}</h3>
              </div>
              <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 px-2 py-1 rounded border border-sky-800">
                {(weight * 100).toFixed(1)}% Wt
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">Differentiable Soft-Argmax Formula</span>
                <p className="font-mono text-[11px] text-sky-300">
                  p(x, y) = softmax(H · β), &nbsp; β = 30.0
                </p>
                <p className="text-[11px] text-slate-400">
                  Continuous expectation over Gaussian heatmap probability mass ensures gradients flow from ordinal age loss directly back into landmark localization.
                </p>
              </div>

              <div className="space-y-2 pt-1 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Norm Coord (X, Y):</span>
                  <span className="text-slate-200">[{selectedLm.x_norm.toFixed(4)}, {selectedLm.y_norm.toFixed(4)}]</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Original Pixel (X, Y):</span>
                  <span className="text-emerald-400 font-bold">{Math.round(selectedLm.x_orig_px)}, {Math.round(selectedLm.y_orig_px)} px</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
