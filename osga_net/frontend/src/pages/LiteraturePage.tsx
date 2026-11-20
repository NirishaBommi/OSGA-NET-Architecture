import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Info, AlertTriangle, ExternalLink, Award } from "lucide-react";
import { fetchLiterature } from "../services/api";

export const LiteraturePage: React.FC = () => {
  const { data: literatureData, isLoading } = useQuery({
    queryKey: ["literature"],
    queryFn: fetchLiterature,
  });

  const entries = literatureData?.entries || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Table IV — Published Literature Benchmarks</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical trajectory of published bone age assessment methods on the real RSNA Pediatric Bone Age dataset.
          </p>
        </div>
      </div>

      {/* Mandatory Non-Comparable Protocol Notice */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-300 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-200">Protocol Discrepancy Notice (Paper Section VII-A):</strong> All numbers in this table are published figures measured on the real RSNA Pediatric Bone Age dataset (14,236 radiographs). Because published papers differ in preprocessing, network backbones, and train/validation protocols, these figures represent a chronological research trajectory and are <strong>not directly comparable</strong> head-to-head.
        </div>
      </div>

      {/* Literature Leaderboard Table */}
      <div className="rounded-xl bg-navy-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-white">Published RSNA Pediatric Bone Age Results (Table IV)</span>
          <span className="text-slate-500 font-mono">Real RSNA Challenge Test Sets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Method & Architecture</th>
                <th className="py-3 px-4 font-mono">Year</th>
                <th className="py-3 px-4 font-mono">Reported Error</th>
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Academic Reference</th>
                <th className="py-3 px-4">Research Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {entries.map((item, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    item.is_proposed_model
                      ? "bg-sky-500/10 hover:bg-sky-500/15 font-semibold text-sky-200"
                      : "hover:bg-slate-900/40 text-slate-300"
                  }`}
                >
                  <td className="py-3 px-4 font-sans font-medium text-slate-100 flex items-center gap-2">
                    {item.is_proposed_model && <Award className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                    <span>{item.method}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{item.year}</td>
                  <td className="py-3 px-4">
                    {item.mae !== null ? (
                      <span className={`text-sm font-bold ${item.is_proposed_model ? "text-sky-400" : "text-white"}`}>
                        {item.mae.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-sans text-[11px] font-semibold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                        Pending Evaluation
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">{item.metric_name}</td>
                  <td className="py-3 px-4 font-sans text-slate-400 text-[11px] max-w-xs truncate" title={item.reference}>
                    {item.reference}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-500 text-[11px] max-w-sm truncate" title={item.note}>
                    {item.note}
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
