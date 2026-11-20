import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Eye, Layers, Sliders, Info } from "lucide-react";
import { LandmarkCoord, RegionBox } from "../types";

interface ImageViewerProps {
  imageSrc: string;
  imageWidth?: number;
  imageHeight?: number;
  landmarks?: LandmarkCoord[];
  nodeWeights?: Record<string, number>;
  regions?: RegionBox[] | null;
  edges?: Array<[number, number]>;
  selectedNodeId?: number | null;
  onSelectNode?: (nodeId: number) => void;
  showOverlayControls?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  imageWidth = 512,
  imageHeight = 512,
  landmarks = [],
  nodeWeights = {},
  regions = null,
  edges = [],
  selectedNodeId = null,
  onSelectNode,
  showOverlayControls = true,
}) => {
  // Viewer Display Controls (Display only - explicitly NOT used by model)
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);

  // Overlay Toggles
  const [showImage, setShowImage] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showEdges, setShowEdges] = useState<boolean>(true);
  const [showRegions, setShowRegions] = useState<boolean>(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(90);

  // Pan & Zoom
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Fit to screen on initial mount
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 6));
  };

  const maxWeight = Math.max(...Object.values(nodeWeights), 0.05);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* 1. Viewer Toolbar */}
      <div className="h-11 bg-navy-900 border-b border-slate-800 px-3 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Hand Radiograph Canvas</span>
          <span className="text-slate-500">•</span>
          <span className="text-[11px] font-mono text-slate-400">
            {imageWidth}×{imageHeight} px
          </span>
          <span className="text-[11px] font-mono text-sky-400">
            Zoom: {Math.round(scale * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale((s) => Math.min(s * 1.25, 6))}
            title="Zoom In"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s * 0.8, 0.4))}
            title="Zoom Out"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Reset View"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden canvas-grid cursor-grab active:cursor-grabbing flex items-center justify-center bg-slate-950"
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          className="relative inline-block select-none pointer-events-none"
        >
          {/* Base Radiograph */}
          {showImage && (
            <img
              src={imageSrc}
              alt="Hand Radiograph"
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                maxWidth: "none",
                display: "block",
              }}
              className="rounded shadow-2xl"
              draggable={false}
            />
          )}

          {/* Overlays SVG Canvas aligned to native image coordinate plane */}
          <svg
            className="absolute inset-0 pointer-events-auto"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            style={{ width: "100%", height: "100%", opacity: overlayOpacity / 100 }}
          >
            {/* Graph Edges */}
            {showEdges &&
              edges.map(([sIdx, tIdx], i) => {
                const sNode = landmarks.find((l) => l.node_id === sIdx);
                const tNode = landmarks.find((l) => l.node_id === tIdx);
                if (!sNode || !tNode) return null;
                const isSelected = selectedNodeId === sIdx || selectedNodeId === tIdx;
                return (
                  <line
                    key={`edge-${i}`}
                    x1={sNode.x_orig_px}
                    y1={sNode.y_orig_px}
                    x2={tNode.x_orig_px}
                    y2={tNode.y_orig_px}
                    stroke={isSelected ? "#38bdf8" : "#0284c7"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeOpacity={isSelected ? 0.95 : 0.6}
                    strokeDasharray={isSelected ? "none" : "3,3"}
                  />
                );
              })}

            {/* Regional RoI Boxes */}
            {showRegions &&
              regions &&
              regions.map((reg) => {
                const [x1, y1, x2, y2] = reg.box_orig_px;
                const isSelected = selectedNodeId === reg.node_id;
                return (
                  <rect
                    key={`box-${reg.node_id}`}
                    x={x1}
                    y={y1}
                    width={Math.max(x2 - x1, 4)}
                    height={Math.max(y2 - y1, 4)}
                    fill={isSelected ? "rgba(14, 165, 233, 0.25)" : "rgba(2, 132, 199, 0.08)"}
                    stroke={isSelected ? "#38bdf8" : "#0284c7"}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer transition-colors"
                    onClick={() => onSelectNode && onSelectNode(reg.node_id)}
                  >
                    <title>{`${reg.name.replace("_", " ")}: [${Math.round(x1)}, ${Math.round(y1)}, ${Math.round(x2)}, ${Math.round(y2)}]`}</title>
                  </rect>
                );
              })}

            {/* 13 Landmark Nodes */}
            {showLandmarks &&
              landmarks.map((lm) => {
                const isSelected = selectedNodeId === lm.node_id;
                const weight = nodeWeights[lm.name] || 0.05;
                const radius = isSelected ? 8 : 4 + 7 * (weight / maxWeight);

                return (
                  <g
                    key={`node-${lm.node_id}`}
                    className="cursor-pointer"
                    onClick={() => onSelectNode && onSelectNode(lm.node_id)}
                  >
                    {/* Pulsing ring for selected node */}
                    {isSelected && (
                      <circle
                        cx={lm.x_orig_px}
                        cy={lm.y_orig_px}
                        r={radius + 5}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${lm.x_orig_px}px ${lm.y_orig_px}px` }}
                      />
                    )}
                    <circle
                      cx={lm.x_orig_px}
                      cy={lm.y_orig_px}
                      r={radius}
                      fill={isSelected ? "#38bdf8" : "#f97316"}
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="transition-transform hover:scale-125"
                    />
                    <text
                      x={lm.x_orig_px + 8}
                      y={lm.y_orig_px + 4}
                      fill="#ffffff"
                      fontSize="9"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      stroke="#0b132b"
                      strokeWidth="2"
                      paintOrder="stroke"
                      className="pointer-events-none select-none text-[9px]"
                    >
                      {lm.node_id}: {lm.name.split("_")[0]}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      {/* 3. Overlay & Windowing Controls Bar */}
      {showOverlayControls && (
        <div className="bg-navy-900 border-t border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Overlay Visibility Toggles */}
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Layers:</span>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showImage}
                onChange={(e) => setShowImage(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
              />
              <span>X-Ray</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
              />
              <span>13 Landmarks</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showEdges}
                onChange={(e) => setShowEdges(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
              />
              <span>20 Edges</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showRegions}
                onChange={(e) => setShowRegions(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
              />
              <span>RoI Boxes</span>
            </label>
          </div>

          {/* Display-Only Windowing (Contrast & Brightness) */}
          <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
            <div className="flex items-center gap-2" title="Viewer display only - NOT used by the model">
              <span className="text-slate-400 text-[11px]">Brightness:</span>
              <input
                type="range"
                min="50"
                max="180"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
            <div className="flex items-center gap-2" title="Viewer display only - NOT used by the model">
              <span className="text-slate-400 text-[11px]">Contrast:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
            <span className="text-[10px] text-slate-500 italic hidden xl:inline">
              (Display only — not used by model)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
