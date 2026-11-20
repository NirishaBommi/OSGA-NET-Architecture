import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, Eye, Info, CheckCircle2 } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults, fetchModelStatus } from "../services/api";

export const FilmModulationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

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

  const film = result?.film;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-purple-400">FiLM Modulation</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Per-Node FiLM Metadata Conditioning</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Feature-wise Linear Modulation dynamically adapts ossification node representations based on clinical sex.
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

      {/* FiLM Formula Banner */}
      <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-3">
        <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Affine Modulation Equation</h2>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-sm text-sky-300">
          x'_i = (1 + γ_i) ⊙ x_i + β_i
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          The metadata vector <code className="text-slate-300 font-mono bg-slate-950 px-1 py-0.5 rounded border border-slate-800">[sex, chron_norm, mask]</code> is encoded by a 2-layer MLP (128-d) and summed with learned node embeddings <code className="text-slate-300 font-mono bg-slate-950 px-1 py-0.5 rounded border border-slate-800">node_emb[i]</code>. A linear layer generates site-specific scale γ and shift β vectors initialized to 0 (identity transform at training start).
        </p>
      </div>

      {/* Summary Stats or Conceptual Status */}
      {film ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Scale Parameter (γ) Summary</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Minimum Scale (γ):</span>
                <span className="text-slate-200">{film.gamma_summary?.min.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Mean Scale (γ):</span>
                <span className="text-emerald-400 font-bold">{film.gamma_summary?.mean.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Maximum Scale (γ):</span>
                <span className="text-slate-200">{film.gamma_summary?.max.toFixed(4) ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Shift Parameter (β) Summary</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Minimum Shift (β):</span>
                <span className="text-slate-200">{film.beta_summary?.min.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Mean Shift (β):</span>
                <span className="text-emerald-400 font-bold">{film.beta_summary?.mean.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Maximum Shift (β):</span>
                <span className="text-slate-200">{film.beta_summary?.max.toFixed(4) ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-navy-900/60 border border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">
            FiLM summary parameters are captured when auxiliary inference is active. Run inference or demonstration mode to view live gamma and beta values.
          </p>
        </div>
      )}

      {/* Clinical Rationale */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-400">
        <h3 className="text-xs font-semibold text-slate-200">Clinical Rationale (Paper Section IV-D)</h3>
        <p className="leading-relaxed">
          Skeletal maturation trajectories differ significantly by biological sex: female skeletal ossification centers generally mature 1.5 to 2.0 years earlier than male centers during puberty. Instead of applying a single flat scalar offset at the end, per-node FiLM allows sex metadata to independently modulate carpal centers (critical in early childhood) versus epiphyseal fusion zones (critical during adolescent growth plate closure).
        </p>
      </div>
    </div>
  );
};
