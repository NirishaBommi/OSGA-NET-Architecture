import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Share2, Eye, Info, AlertTriangle } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults, fetchModelArchitecture } from "../services/api";

export const GraphAttentionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedHead, setSelectedHead] = useState<number>(0);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);

  const { data: result } = useQuery({
    queryKey: ["assessmentResults", id],
    queryFn: () => fetchAssessmentResults(id!),
    enabled: !!id,
  });

  const { data: arch } = useQuery({
    queryKey: ["modelArchitecture"],
    queryFn: fetchModelArchitecture,
  });

  const edges = arch?.edges || [];
  const nodes = arch?.nodes || [];
  const attentionTensor = result?.graph?.attention; // [layer][head][13][13]

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-teal-400">Graph Attention Network</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Structural Graph Attention Network (GAT)</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            2-layer, 4-head dense multi-head graph attention over fixed anatomical adjacency.
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

      {/* Mandatory Interpretability Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-300 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-200">Interpretability Honesty Notice:</strong> Graph attention weights (α_ij) quantify internal feature routing along the anatomical graph edges during neural message passing. Attention weights do <strong>not</strong> necessarily correspond to clinical pathology or medical importance, and must not be used as standalone clinical proof.
        </div>
      </div>

      {/* Layer and Head Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-navy-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">GAT Layer:</span>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setSelectedLayer(0)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedLayer === 0 ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Layer 1 (Input: 1280-d)
            </button>
            <button
              onClick={() => setSelectedLayer(1)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedLayer === 1 ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Layer 2 (Output: 1024-d)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Attention Head:</span>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {[0, 1, 2, 3].map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHead(h)}
                className={`w-7 h-7 rounded text-xs font-mono font-medium transition-colors ${
                  selectedHead === h ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                H{h + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 20 Anatomical Edges Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <h2 className="font-semibold text-white">20 Biological Adjacency Edges</h2>
          <span className="text-slate-500 font-mono">Radius/Ulna → Carpals → Metacarpals → Phalanges</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {edges.map((edge, idx) => {
            let attnValue: number | null = null;
            if (
              attentionTensor &&
              attentionTensor[selectedLayer] &&
              attentionTensor[selectedLayer][selectedHead]
            ) {
              attnValue = attentionTensor[selectedLayer][selectedHead][edge.source][edge.target];
            }

            return (
              <div key={idx} className="p-3 rounded-lg bg-navy-900 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Edge #{idx + 1}</span>
                  {attnValue !== null && (
                    <span className="text-sky-400 font-bold">α = {attnValue.toFixed(4)}</span>
                  )}
                </div>
                <div className="font-medium text-slate-200">
                  <span className="text-sky-300">{edge.name_source.replace("_", " ")}</span>
                  <span className="text-slate-500 mx-1.5">↔</span>
                  <span className="text-emerald-300">{edge.name_target.replace("_", " ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
