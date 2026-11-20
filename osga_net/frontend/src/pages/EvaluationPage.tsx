import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Info, AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react";
import { fetchEvaluation } from "../services/api";

export const EvaluationPage: React.FC = () => {
  const [split, setSplit] = useState<string>("val");

  const { data: evaluation, isLoading } = useQuery({
    queryKey: ["evaluation", split],
    queryFn: () => fetchEvaluation(split),
  });

  const overall = evaluation?.overall;
  const stratified = evaluation?.stratified;
  const calib = evaluation?.calibration;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">RSNA Benchmark Evaluation Suite</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical validation metrics across overall, sex-stratified, and age-band splits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Split:</span>
          <div className="flex rounded-lg bg-navy-900 p-1 border border-slate-800 text-xs">
            {["val", "test", "train"].map((s) => (
              <button
                key={s}
                onClick={() => setSplit(s)}
                className={`px-3 py-1 rounded capitalize font-medium transition-colors ${
                  split === s ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State when Evaluation has not been run */}
      {!evaluation?.available && (
        <div className="p-8 rounded-xl bg-navy-900 border border-slate-800 text-center space-y-4 max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Evaluation Pending (No Metrics Shipped)</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              In accordance with non-negotiable honesty rules, no synthetic benchmark results are fabricated. Train your model on real RSNA data and execute <code className="text-sky-300 font-mono">evaluate.py</code> to populate this dashboard.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 text-left max-w-lg mx-auto">
            # Run evaluation on validation split:<br />
            python evaluate.py --ckpt runs/osga/best.pt --splits data/splits.csv --split val
          </div>
        </div>
      )}

      {/* Active Evaluation Metrics if available */}
      {evaluation?.available && overall && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Mean Absolute Error (MAE)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sky-400">{overall.mae.toFixed(2)}</span>
                <span className="text-xs text-slate-400">months</span>
              </div>
              {overall.mae_ci95 && (
                <span className="text-[11px] font-mono text-slate-500 block">
                  95% CI: [{overall.mae_ci95[0].toFixed(2)}, {overall.mae_ci95[1].toFixed(2)}]
                </span>
              )}
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Root Mean Squared Error (RMSE)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{overall.rmse.toFixed(2)}</span>
                <span className="text-xs text-slate-400">months</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Accuracy ≤ 6 Months</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">{overall.acc_6mo.toFixed(1)}%</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Accuracy ≤ 12 Months</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">{overall.acc_12mo.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Stratified Breakdown Table */}
          {stratified && (
            <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white">Stratified Cohort Analysis</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Subgroup Stratum</th>
                      <th className="py-2.5 px-3 font-mono">Sample Size (n)</th>
                      <th className="py-2.5 px-3 font-mono">MAE (months)</th>
                      <th className="py-2.5 px-3 font-mono">RMSE (months)</th>
                      <th className="py-2.5 px-3 font-mono">Acc ≤ 6m</th>
                      <th className="py-2.5 px-3 font-mono">Acc ≤ 12m</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {stratified.female && (
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200">Female Cohort</td>
                        <td className="py-2.5 px-3 text-slate-400">{stratified.female.n}</td>
                        <td className="py-2.5 px-3 text-sky-400 font-bold">{stratified.female.mae?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-slate-300">{stratified.female.rmse?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.female.acc_6mo?.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.female.acc_12mo?.toFixed(1)}%</td>
                      </tr>
                    )}
                    {stratified.male && (
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200">Male Cohort</td>
                        <td className="py-2.5 px-3 text-slate-400">{stratified.male.n}</td>
                        <td className="py-2.5 px-3 text-sky-400 font-bold">{stratified.male.mae?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-slate-300">{stratified.male.rmse?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.male.acc_6mo?.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.male.acc_12mo?.toFixed(1)}%</td>
                      </tr>
                    )}
                    {stratified.younger_band && (
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200">Pre-Pubertal (F≤11y, M≤13y)</td>
                        <td className="py-2.5 px-3 text-slate-400">{stratified.younger_band.n}</td>
                        <td className="py-2.5 px-3 text-sky-400 font-bold">{stratified.younger_band.mae?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-slate-300">{stratified.younger_band.rmse?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.younger_band.acc_6mo?.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-emerald-400">{stratified.younger_band.acc_12mo?.toFixed(1)}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
