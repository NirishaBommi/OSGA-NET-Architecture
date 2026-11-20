import React from "react";
import { AlertCircle } from "lucide-react";

export const DisclaimerBanner: React.FC = () => {
  return (
    <aside aria-label="Clinical Disclaimer" className="bg-slate-900/90 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 select-none z-40">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span>
          <strong className="text-slate-300 font-medium">Research Prototype:</strong> Results are intended for research and educational demonstration and must not be used as the sole basis for clinical decisions.
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
        <span>OSGA-Net v2.0</span>
        <span>•</span>
        <span>RSNA Benchmark</span>
      </div>
    </aside>
  );
};
