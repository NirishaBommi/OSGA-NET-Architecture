import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sliders, ArrowRight, CheckCircle2, Info, Eye } from "lucide-react";
import { fetchAssessment, fetchAssessmentResults } from "../services/api";

export const PreprocessingPage: React.FC = () => {
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

  const w = assessment?.image_original_width || 384;
  const h = assessment?.image_original_height || 384;
  const S = Math.max(w, h);
  const px = Math.floor((S - w) / 2);
  const py = Math.floor((S - h) / 2);
  const imgSize = result?.model.img_size || 384;

  const steps = [
    {
      step: 1,
      name: "Grayscale Standardisation",
      details: "Converts color or 16-bit scans into standard uint8 single-channel representations.",
      params: "cv2.COLOR_RGB2GRAY",
      code: "osga/dataset.py:read_gray",
    },
    {
      step: 2,
      name: "CLAHE Enhancement",
      details: "Contrast Limited Adaptive Histogram Equalization prevents local over-amplification while highlighting fine trabecular bone contours and epiphyseal plates.",
      params: "clipLimit=2.0, tileGridSize=(8, 8)",
      code: "osga/dataset.py:prepare_image",
    },
    {
      step: 3,
      name: "Border-Median Square Padding",
      details: `Pads rectangular image (${w}x${h}) to square (${S}x${S}) without distorting hand aspect ratio, filling borders with the median border intensity (${px}px X-pad, ${py}px Y-pad).`,
      params: `px=${px}, py=${py}, S=${S}`,
      code: "osga/dataset.py:prepare_image",
    },
    {
      step: 4,
      name: "Bicubic / Area Downsampling",
      details: `Resamples square padded radiograph to the exact model input dimension (${imgSize}x${imgSize}) specified in the checkpoint configuration.`,
      params: `img_size=${imgSize}`,
      code: "osga/dataset.py:prepare_image",
    },
    {
      step: 5,
      name: "ImageNet Channel Normalisation",
      details: "Replicates single channel to 3 channels and standardises against ImageNet statistics for EfficientNetV2-S feature extraction.",
      params: "mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]",
      code: "osga/dataset.py:to_tensor",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to={`/assessments/${id}/viewer`} className="hover:text-white">Study {id}</Link>
            <span>/</span>
            <span className="text-sky-400">Preprocessing Pipeline</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Standardized Preprocessing Pipeline</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Identical mathematical transforms executed at both training and inference time.
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

      {/* Geometry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-navy-900 border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Original Dimensions</span>
          <span className="text-xl font-bold font-mono text-white">{w} × {h}</span>
          <span className="text-xs text-slate-500 block mt-0.5">pixels</span>
        </div>
        <div className="p-4 rounded-xl bg-navy-900 border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Square Padded Side (S)</span>
          <span className="text-xl font-bold font-mono text-sky-400">{S} × {S}</span>
          <span className="text-xs text-slate-500 block mt-0.5">pixels</span>
        </div>
        <div className="p-4 rounded-xl bg-navy-900 border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Applied Padding (px, py)</span>
          <span className="text-xl font-bold font-mono text-amber-400">+{px}, +{py}</span>
          <span className="text-xs text-slate-500 block mt-0.5">offset pixels</span>
        </div>
        <div className="p-4 rounded-xl bg-navy-900 border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Model Tensor Size</span>
          <span className="text-xl font-bold font-mono text-emerald-400">{imgSize} × {imgSize}</span>
          <span className="text-xs text-slate-500 block mt-0.5">input resolution</span>
        </div>
      </div>

      {/* Pipeline Steps Sequence */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Pipeline Execution Sequence</h2>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.step} className="p-4 rounded-xl bg-navy-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 text-xs font-bold font-mono flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">{s.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{s.details}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 md:min-w-64">
                <span className="text-[11px] font-mono text-sky-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 block mb-1">
                  {s.params}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{s.code}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
