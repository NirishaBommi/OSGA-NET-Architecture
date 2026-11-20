import React from "react";
import { ModelMode } from "../types";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface ModeBadgeProps {
  mode?: ModelMode;
  className?: string;
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode = "integration_pending", className = "" }) => {
  if (mode === "real_inference") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-sm ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Real Inference Active</span>
      </div>
    );
  }

  if (mode === "demonstration") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/80 shadow-sm ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Demonstration Mode</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-sky-400 border border-slate-700/80 shadow-sm ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      <span>Integration Pending</span>
    </div>
  );
};
