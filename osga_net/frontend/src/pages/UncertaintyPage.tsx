import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Eye, AlertTriangle, Info, CheckCircle2, AlertOctagon } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults } from "../services/api";

export const UncertaintyPage: React.FC = () => {
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

  const uncertainty = result?.uncertainty;
  const std = uncertainty?.standard_deviation || 0;
  const variance = uncertainty?.variance || 0;
  const p95 = uncertainty?.central_95_mass_interval_months || [0, 0];
  const needsReview = uncertainty?.needs_review;
  const calibrated = uncertainty?.calibrated || false;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-rose-400">Uncertainty & Triage</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Uncertainty Quantification & Triage</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistical dispersion metrics derived from the ordinal probability mass function.
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

      {/* Primary Triage Alert Card */}
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          needsReview
            ? "bg-amber-950/40 border-amber-800/80 text-amber-200"
            : "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
        }`}
      >
        <div className="flex items-start gap-3">
          {needsReview ? (
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              {needsReview ? "Manual Review Recommended" : "Within Standard Operating Dispersion"}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
              {needsReview
                ? "The predicted distribution standard deviation exceeds the operating review threshold. Full manual Greulich-Pyle or Tanner-Whitehouse evaluation is advised."
                : "The predicted distribution standard deviation is within the 90th percentile operating boundary."}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end flex-shrink-0">
          <span
            className={`px-3 py-1 rounded text-xs font-bold font-mono uppercase ${
              calibrated
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : "bg-slate-900 text-slate-400 border border-slate-700"
            }`}
          >
            {calibrated ? "Calibrated Threshold" : "Uncalibrated Operating Point"}
          </span>
        </div>
      </div>

      {/* Uncertainty Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Standard Deviation (σ)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">±{std.toFixed(2)}</span>
            <span className="text-xs text-slate-400">months</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-mono">σ = sqrt(Var[p])</span>
        </div>

        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Distribution Variance (σ²)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-400">{variance.toFixed(2)}</span>
            <span className="text-xs text-slate-400">mo²</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-mono">Var = Σ p(k)(k - μ)²</span>
        </div>

        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Central 95% Mass Interval</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {p95[0].toFixed(0)} – {p95[1].toFixed(0)}
            </span>
            <span className="text-xs text-slate-400">months</span>
          </div>
          <span className="text-[11px] text-slate-500 block">Central 95% distribution mass</span>
        </div>
      </div>

      {/* Mandatory Statistical Explanation */}
      <div className="p-5 rounded-xl bg-navy-900/60 border border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Scientific Definition of Uncertainty Bounds</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The 95% interval represents the central 95% probability mass of the model's 228-bin output distribution. It is <strong>not</strong> a clinically validated frequentist confidence interval. It reflects the entropy and dispersion of the ordinal softmax distribution given the input radiograph.
        </p>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono space-y-1">
          <p>• Calibration source: calibration.json (90th percentile of validation sigma)</p>
          <p>• Operating point status: {calibrated ? "Active from evaluation run" : "Pending evaluate.py run"}</p>
        </div>
      </div>
    </div>
  );
};
