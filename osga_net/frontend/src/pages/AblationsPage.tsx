import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table as TableIcon, Info, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fetchAblations } from "../services/api";

export const AblationsPage: React.FC = () => {
  const [split, setSplit] = useState<string>("val");

  const { data: ablationsData, isLoading } = useQuery({
    queryKey: ["ablations", split],
    queryFn: () => fetchAblations(split),
  });

  const ablations = ablationsData?.ablations || [];
  const baselines = ablationsData?.baselines || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Table V — Systematic Ablation Study</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Controlled component contribution analysis across graph reasoning, FiLM fusion, ordinal head, and landmarks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Split:</span>
          <div className="flex rounded-lg bg-navy-900 p-1 border border-slate-800 text-xs">
            {["val", "test"].map((s) => (
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

      {/* Honesty Banner */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 font-medium">Ablation Methodology (Paper Section IV):</strong> Each variant is trained under identical hyperparameters using <code className="text-sky-300 font-mono">ablation.py</code>. The "-FiLM" configuration substitutes concatenation of the same clinical metadata to isolate the fusion operator. Rows without trained checkpoints truthfully display as <em>Not Run / Evaluation Pending</em>.
        </div>
      </div>

      {/* Table V: Architectural Ablation Configurations */}
      <div className="rounded-xl bg-navy-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-white">OSGA-Net Architectural Ablations (Table V)</span>
          <span className="text-slate-500 font-mono">MAE in months ({split} split)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Configuration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 font-mono">MAE (months)</th>
                <th className="py-3 px-4 font-mono">95% CI</th>
                <th className="py-3 px-4 font-mono">RMSE (months)</th>
                <th className="py-3 px-4 font-mono">Acc ≤ 12m</th>
                <th className="py-3 px-4 text-right">vs Full OSGA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ablations.map((row) => (
                <tr key={row.key} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">{row.label}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-medium uppercase ${
                        row.status === "completed"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {row.status === "completed" ? "Evaluated" : "Not Run"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-sky-400">
                    {row.mae !== null ? row.mae.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {row.ci95 ? `[${row.ci95[0].toFixed(2)}, ${row.ci95[1].toFixed(2)}]` : "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {row.rmse !== null ? row.rmse.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4 text-emerald-400">
                    {row.acc12 !== null ? `${row.acc12.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.pct_change_vs_full !== null ? (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                        row.pct_change_vs_full > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        {row.pct_change_vs_full > 0 ? `+${row.pct_change_vs_full}%` : `${row.pct_change_vs_full}%`}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controlled Baseline Suite */}
      <div className="rounded-xl bg-navy-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-white">Controlled Baselines Re-implemented in Repository</span>
          <span className="text-slate-500 font-mono">Standardised ResNet / EfficientNet benchmarks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Baseline Model</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 font-mono">MAE (months)</th>
                <th className="py-3 px-4 font-mono">RMSE (months)</th>
                <th className="py-3 px-4 font-mono">Acc ≤ 12m</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {baselines.map((row) => (
                <tr key={row.key} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">{row.label}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-medium uppercase ${
                        row.status === "completed"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {row.status === "completed" ? "Evaluated" : "Not Run"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-sky-400">
                    {row.mae !== null ? row.mae.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {row.rmse !== null ? row.rmse.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4 text-emerald-400">
                    {row.acc12 !== null ? `${row.acc12.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
