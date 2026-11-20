import React from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, ShieldCheck, Cpu, GitFork, BarChart3, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchModelStatus } from "../services/api";
import { ModeBadge } from "../components/ModeBadge";

export const Landing: React.FC = () => {
  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10 flex flex-col justify-between">
      <div className="max-w-5xl mx-auto w-full space-y-10 my-auto">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-sky-950/60 text-sky-400 border border-sky-800/80">
            <Activity className="w-3.5 h-3.5" />
            <span>OSGA-Net Research Prototype v2.0</span>
          </div>
          <ModeBadge mode={status?.mode} />
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Structure-Aware Skeletal Bone Age Assessment
          </h1>
          <p className="text-base md:text-lg text-slate-300 leading-relaxed">
            Opening the black box of radiological bone age evaluation with 13 explicit anatomical ossification landmarks, per-node FiLM metadata modulation, Graph Attention Networks (GAT), and ordinal age distribution regression.
          </p>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-sky-500/20"
          >
            <span>Open Clinical Workstation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/architecture"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors"
          >
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Architecture Explorer</span>
          </Link>
          <Link
            to="/presentation"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>11-Stage Presentation Tour</span>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-slate-800/80">
          <div className="p-5 rounded-lg bg-navy-900/60 border border-slate-800/80 space-y-2.5">
            <div className="w-9 h-9 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-white">Anatomical Graph Attention</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Decomposes the hand into 13 ossification centers and 20 biological edges to model structural maturation dependencies rather than treating radiographs as flat global embeddings.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-navy-900/60 border border-slate-800/80 space-y-2.5">
            <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-white">Ordinal Uncertainty & Triage</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Predicts a calibrated 228-bin ordinal age distribution. High standard deviation cases are automatically flagged for manual radiologist audit.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-navy-900/60 border border-slate-800/80 space-y-2.5">
            <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-white">Scientific Honesty Guarantee</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strictly zero fabricated numbers. Explicitly isolates real checkpoint evaluations from presentation demonstrations. Missing checkpoints show clean integration states.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
