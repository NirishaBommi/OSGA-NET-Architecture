import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, ArrowRight, Layers, FileCode, CheckCircle2, ChevronRight, Share2, Box } from "lucide-react";
import { fetchModelArchitecture, fetchModelStatus } from "../services/api";

export const ArchitectureExplorer: React.FC = () => {
  const { data: arch } = useQuery({
    queryKey: ["modelArchitecture"],
    queryFn: fetchModelArchitecture,
  });

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  const [selectedLayerId, setSelectedLayerId] = useState<string>("gat");

  const layers = arch?.layers || [];
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || layers[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">OSGA-Net Architecture Explorer</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive structural decomposition of the 5-stage neural pipeline with parameterized tensor shapes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-sky-400 bg-sky-950/60 border border-sky-800 px-2.5 py-1 rounded">
            Input: {status?.img_size || 384}×{status?.img_size || 384}
          </span>
        </div>
      </div>

      {/* Interactive Visual Graph Sequence */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 pt-2">
        {layers.map((l, idx) => {
          const isSelected = selectedLayerId === l.id;
          return (
            <div
              key={l.id}
              onClick={() => setSelectedLayerId(l.id)}
              className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10"
                  : "bg-navy-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <div>
                <span className="text-[10px] font-mono text-slate-500 block mb-1">Stage {idx + 1}</span>
                <h3 className={`text-xs font-semibold leading-tight ${isSelected ? "text-sky-300" : "text-white"}`}>
                  {l.name}
                </h3>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-400 block truncate">{l.output_shape}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer Detail Deep Dive Card */}
      {selectedLayer && (
        <div className="p-6 rounded-xl bg-navy-900 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs font-mono text-sky-400 uppercase tracking-wider block">
                {selectedLayer.type}
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">{selectedLayer.name}</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-500">{selectedLayer.source_file}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Functional Description</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{selectedLayer.description}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Mathematical Formulation</h3>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
                  {selectedLayer.equation}
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tensor Dimensionality</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Input Tensor:</span>
                  <span className="font-mono text-slate-200">{selectedLayer.input_shape}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Output Tensor:</span>
                  <span className="font-mono text-emerald-400 font-medium">{selectedLayer.output_shape}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Implementation:</span>
                  <span className="font-mono text-slate-300 text-[11px]">{selectedLayer.source_file}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structural Graph Topology Summary */}
      <div className="p-5 rounded-xl bg-navy-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Anatomical Graph Adjacency Configuration</h2>
        <p className="text-xs text-slate-400">
          OSGA-Net constructs a fixed anatomical adjacency graph with 13 nodes (radius, ulna, 4 carpal clusters, 5 metacarpals, and 2 phalanges) connected by 20 undirected biological edges reflecting natural ossification pathways.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {arch?.nodes.map((n) => (
            <span
              key={n.id}
              className="text-[11px] font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300"
            >
              <strong className="text-sky-400">{n.id}</strong>: {n.name.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
