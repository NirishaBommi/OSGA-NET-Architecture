import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Layers,
  Share2,
  TrendingUp,
  MapPin,
  Box,
  FileCheck,
  CheckCircle2,
} from "lucide-react";

export const PresentationMode: React.FC = () => {
  const [currentStage, setCurrentStage] = useState<number>(1);

  const stages = [
    {
      num: 1,
      title: "Clinical Motivation & The Radiologist's Challenge",
      subtitle: "Why Pediatric Bone Age Assessment (BAA) Demands Explainability",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Skeletal bone age assessment from left-hand radiographs is central to diagnosing pediatric growth and endocrine disorders (growth hormone deficiency, precocious puberty, and Turner syndrome). Discrepancies of even a few months directly alter hormone therapy decisions.
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Limitations of Current Clinical Standards</h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li><strong>Greulich-Pyle (G&P) Atlas:</strong> High inter-rater variability (often 6 to 12 months discrepancy between radiologists).</li>
              <li><strong>Tanner-Whitehouse (TW3) Scoring:</strong> Extremely time-intensive (scoring 13 to 20 individual bones manually).</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      num: 2,
      title: "The Failure of 'Black-Box' Deep Learning",
      subtitle: "Why Flat Image CNNs Fail Clinical Scrutiny",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Standard deep learning models treat the hand radiograph as a single global feature map, fusing it with sex via late concatenation. This approach has critical drawbacks:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-rose-400">Ignores Correlated Maturation</span>
              <p className="text-xs text-slate-400">Different ossification centers (carpals vs phalanges) mature in anatomically coordinated developmental trajectories, not independently.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-rose-400">No Verifiable Intermediate State</span>
              <p className="text-xs text-slate-400">Clinicians cannot verify whether the model grounded its estimate on valid epiphyses or background image artifacts.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 3,
      title: "Standardized Preprocessing Pipeline",
      subtitle: "Identical Mathematical Transforms at Training and Inference",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            The workstation enforces deterministic image normalization to match model assumptions:
          </p>
          <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-950 p-4 rounded-xl border border-slate-800">
            <li><strong>Grayscale Conversion:</strong> Single-channel uint8.</li>
            <li><strong>CLAHE Enhancement:</strong> Clip limit 2.0 on 8x8 tiles to resolve faint epiphyseal fusion lines.</li>
            <li><strong>Border-Median Square Padding:</strong> Aspect-preserving padding using border median to eliminate aspect distortion.</li>
            <li><strong>Resize to Checkpoint Size:</strong> Standard 384x384 input resolution.</li>
            <li><strong>ImageNet Normalisation:</strong> Mean and std standardisation.</li>
          </ol>
        </div>
      ),
    },
    {
      num: 4,
      title: "13 Anatomical Landmarks & Auxiliary Heatmaps",
      subtitle: "Differentiable Soft-Argmax Spatial Grounding",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            OSGA-Net includes an auxiliary landmark head predicting 13 Gaussian heatmaps at stride 8 (48x48):
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p className="text-slate-300">
              <strong>The 13 Anatomical Centers:</strong> Distal Radius, Distal Ulna, 4 Carpal Clusters (Scaphoid/Lunate, Capitate, Hamate, Triquetrum), 5 Metacarpal Epiphyses (MC1–MC5), and 2 Phalangeal Reference Centers.
            </p>
            <p className="text-sky-300 font-mono">
              Coords = SoftArgmax(Heatmaps, β=30.0)
            </p>
            <p className="text-slate-400">
              Continuous expectation guarantees gradients flow end-to-end while giving the radiologist an inspectable localization overlay.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 5,
      title: "RoIAlign Region Feature Pooling",
      subtitle: "Extracting Clean Local Representations Without Patch Cropping",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Rather than feeding hard image crops, OSGA-Net applies RoIAlign directly to the EfficientNetV2-S trunk feature map:
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p className="text-slate-300">
              Bounding boxes centered on soft-argmax coordinates (width fraction 0.17) pool 2x2 bilinear samples, averaged to 1280-d feature vectors.
            </p>
            <p className="text-emerald-400 font-mono">
              v_i = RoIAlign(feat, Box_i) + CoordEmbed(Coords_i)
            </p>
            <p className="text-slate-400">
              Landmark coordinates are detached for box extraction, eliminating coordinate jitter during optimization.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 6,
      title: "Per-Node FiLM Metadata Conditioning",
      subtitle: "Site-Specific Modulation by Biological Sex",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Female skeletal maturation precedes male maturation by 1.5 to 2.0 years during puberty. A global scalar offset cannot capture site-specific differences.
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p className="text-purple-300 font-mono font-bold text-sm">
              v'_i = (1 + γ_i) ⊙ v_i + β_i
            </p>
            <p className="text-slate-300 leading-relaxed">
              Per-node FiLM dynamically modulates carpal features for young children (where carpal appearance is key) and epiphyseal fusion features for adolescents (where growth plate closure dominates).
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 7,
      title: "Structural Graph Attention Reasoning",
      subtitle: "2-Layer GAT Propagating Information Along 20 Biological Edges",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            The 13 nodes form an anatomically motivated graph connected by 20 undirected biological edges:
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p className="text-slate-300 font-medium">Radius/Ulna → Carpals → Metacarpals → Phalanges</p>
            <p className="text-slate-400">
              Two dense GAT layers with 4 attention heads each (total 1024-d) propagate developmental context along the graph, mirroring how a radiologist cross-references ossification centers.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 8,
      title: "Ordinal Probability Distribution Head",
      subtitle: "228-Bin Discrete Distribution Trained via Label Distribution Learning",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Instead of standard MSE regression, OSGA-Net predicts a discrete probability distribution over 228 monthly age bins (months 1 to 228 / 0 to 19 years):
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <p className="text-sky-300">Expected Bone Age: ŷ = Σ k · p(k)</p>
            <p className="text-emerald-300">Distribution Variance: σ² = Σ p(k)(k - ŷ)²</p>
            <p className="text-slate-400 font-sans mt-2">
              Trained with Gaussian soft labels (σ = 6 months) using KL divergence loss, regularizing the model and producing smooth probabilistic estimates.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 9,
      title: "Uncertainty Quantification & Clinical Triage",
      subtitle: "Operational Review Flag Based on Calibration Distribution",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            The standard deviation σ of the output distribution serves as a natural proxy for model ambiguity:
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p className="text-amber-300 font-semibold">Triage Operating Point:</p>
            <p className="text-slate-300">
              Cases where σ exceeds the 90th percentile of validation sigma (from calibration.json) trigger an automated "Manual Review Recommended" flag, directing radiologist attention to ambiguous or atypical cases.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 10,
      title: "Systematic Ablations & Academic Honesty",
      subtitle: "Component Isolation Under Identical Protocols",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            The paper establishes a systematic 5-model ablation plan (Table V) plus 3 controlled re-implemented baselines (ResNet-18, EfficientNetV2-S concat, EfficientNetV2-S cross-attn).
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-sky-400">Strict Honesty Rules:</span>
            <p className="text-slate-400">
              No numbers are fabricated. Variants without completed training runs truthfully display as "Not run / Evaluation pending", ensuring scientific integrity.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 11,
      title: "Conclusion & Future Research Roadmap",
      subtitle: "From Research Prototype Toward Multi-Center Prospective Validation",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            OSGA-Net demonstrates that opening the neural network via explicit anatomical landmarks, per-node FiLM, and structural graph attention provides superior interpretability without sacrificing accuracy.
          </p>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <h4 className="font-semibold text-slate-200">Near-Term Next Steps:</h4>
            <ul className="text-slate-400 space-y-1 list-disc list-inside">
              <li>Complete 50-epoch joint training on high-VRAM GPU cluster.</li>
              <li>Evaluate cross-dataset generalization on the Chinese RHPE pediatric dataset.</li>
              <li>Conduct prospective clinical reader studies with pediatric endocrinologists.</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const stage = stages[currentStage - 1];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col justify-between space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">OSGA-Net Thesis & Viva Presentation Mode</h1>
            <p className="text-xs text-slate-400">11-stage guided tour through problem definition, architecture, and scientific validation.</p>
          </div>
        </div>

        {/* Stage Navigation */}
        <div className="flex items-center gap-2">
          <button
            disabled={currentStage <= 1}
            onClick={() => setCurrentStage((s) => Math.max(s - 1, 1))}
            className="p-2 rounded-lg bg-navy-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-sky-400 px-2">
            Stage {currentStage} / {stages.length}
          </span>
          <button
            disabled={currentStage >= stages.length}
            onClick={() => setCurrentStage((s) => Math.min(s + 1, stages.length))}
            className="p-2 rounded-lg bg-navy-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stage Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {stages.map((s) => (
          <button
            key={s.num}
            onClick={() => setCurrentStage(s.num)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono whitespace-nowrap transition-colors ${
              currentStage === s.num
                ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                : "bg-navy-900 border border-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            {s.num}. {s.title.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Slide Presentation Card */}
      <div className="flex-1 bg-navy-900/90 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-2xl flex flex-col justify-between my-auto max-w-4xl w-full mx-auto space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest font-bold">
              Stage {stage.num} of 11
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{stage.title}</h2>
            <p className="text-xs text-sky-400 font-medium">{stage.subtitle}</p>
          </div>

          <div className="pt-2">{stage.content}</div>
        </div>

        {/* Footer controls inside slide */}
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <button
            disabled={currentStage <= 1}
            onClick={() => setCurrentStage((s) => Math.max(s - 1, 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Slide</span>
          </button>

          {currentStage < stages.length ? (
            <button
              onClick={() => setCurrentStage((s) => Math.min(s + 1, stages.length))}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-md shadow-sky-600/20 transition-colors"
            >
              <span>Next Slide</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              <span>Finish Tour & Return to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
