import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Eye,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { fetchAssessment, fetchAssessmentResults } from "../services/api";

export const PredictionPage: React.FC = () => {
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

  const distribution = result?.prediction?.probability_distribution || [];
  const chartData = distribution.map((prob, idx) => ({
    month: idx + 1,
    probability: prob,
    pct: (prob * 100).toFixed(2),
  }));

  const expectedMonths = result?.prediction?.bone_age_months || 0;
  const modeMonths = result?.prediction?.most_probable_age_months || 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-emerald-400">Ordinal Prediction & Distribution</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Ordinal Age Probability Distribution</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            228-bin discrete distribution trained via Kullback-Leibler divergence with Gaussian soft targets.
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

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Predicted Bone Age (Expected Value)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-400">{result?.prediction.bone_age_formatted}</span>
            <span className="text-xs text-slate-400">({expectedMonths.toFixed(1)} mo)</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-mono">E[k] = Σ k · p(k)</span>
        </div>

        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Distribution Mode (Peak Bin)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{modeMonths.toFixed(1)}</span>
            <span className="text-xs text-slate-400">months</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-mono">k* = argmax p(k)</span>
        </div>

        <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Chronological Discrepancy</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">
              {result?.prediction.difference_from_chronological_months !== null && result?.prediction.difference_from_chronological_months !== undefined
                ? `${result.prediction.difference_from_chronological_months > 0 ? "+" : ""}${result.prediction.difference_from_chronological_months} mo`
                : "—"}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            {assessment?.chronological_age_months
              ? `Chronological Age: ${assessment.chronological_age_months} months`
              : "No chronological age recorded"}
          </span>
        </div>
      </div>

      {/* 228-Bin Recharts Distribution Curve */}
      <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Full Probability Density Function across 228 Monthly Bins</h2>
            <p className="text-xs text-slate-400">Continuous density over pediatric age spectrum (1 to 228 months / 0 to 19 years).</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              <span className="text-slate-300">Expected: {expectedMonths.toFixed(1)}m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-slate-300">Mode: {modeMonths.toFixed(1)}m</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(m) => `${m}m`}
                ticks={[12, 36, 60, 84, 108, 132, 156, 180, 204, 228]}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const m = payload[0].payload.month;
                    const p = payload[0].payload.pct;
                    const y = Math.floor(m / 12);
                    const rm = m % 12;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                        <p className="font-semibold text-white">{y} y {rm} m ({m} months)</p>
                        <p className="text-sky-400 font-mono">Probability: {p}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine x={Math.round(expectedMonths)} stroke="#38bdf8" strokeDasharray="3 3" strokeWidth={2} />
              <ReferenceLine x={Math.round(modeMonths)} stroke="#34d399" strokeDasharray="3 3" strokeWidth={2} />
              <Area type="monotone" dataKey="probability" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#probGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
