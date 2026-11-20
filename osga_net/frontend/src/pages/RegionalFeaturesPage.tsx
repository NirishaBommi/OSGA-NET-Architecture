import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Eye, Layers, Info } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults } from "../services/api";

export const RegionalFeaturesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedBoxId, setSelectedBoxId] = useState<number>(0);

  const { data: result } = useQuery({
    queryKey: ["assessmentResults", id],
    queryFn: () => fetchAssessmentResults(id!),
    enabled: !!id,
  });

  const regions = result?.regions || [];
  const selectedRegion = regions.find((r) => r.node_id === selectedBoxId) || regions[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-sky-400">Regional RoI Features</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Heatmap-Guided RoIAlign Region Pooling</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Extracts 13 local ossification feature vectors from the shared EfficientNet feature map.
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

      {/* Explanation Banner */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 font-medium">RoIAlign Mechanism:</strong> Instead of cropping hard image patches, RoIAlign extracts bilinear samples directly from the backbone feature map (`spatial_scale=1.0`, `sampling_ratio=2`) at `roi_frac = 0.17` spatial width. Landmarks are detached for the box coordinate computation, preventing RoI coordinate jitter during backpropagation.
        </div>
      </div>

      {/* Regions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map((reg) => {
          const isSelected = selectedBoxId === reg.node_id;
          const [x1, y1, x2, y2] = reg.box_orig_px;
          const boxW = Math.round(x2 - x1);
          const boxH = Math.round(y2 - y1);

          return (
            <div
              key={reg.node_id}
              onClick={() => setSelectedBoxId(reg.node_id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10"
                  : "bg-navy-900 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                <span className="text-xs font-semibold text-white uppercase">{reg.name.replace("_", " ")}</span>
                <span className="text-[10px] font-mono text-sky-400">Node #{reg.node_id}</span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Box Pixels [X1, Y1]:</span>
                  <span className="text-slate-200">[{Math.round(x1)}, {Math.round(y1)}]</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Box Pixels [X2, Y2]:</span>
                  <span className="text-slate-200">[{Math.round(x2)}, {Math.round(y2)}]</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Box Size:</span>
                  <span className="text-emerald-400 font-bold">{boxW} × {boxH} px</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
