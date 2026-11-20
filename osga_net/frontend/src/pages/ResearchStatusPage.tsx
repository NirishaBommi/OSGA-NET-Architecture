import React, { useState } from "react";
import { Info, CheckCircle2, Clock, AlertCircle, ShieldCheck, UserCheck, Calendar } from "lucide-react";

export const ResearchStatusPage: React.FC = () => {
  // Institutional Details (Editable in client state or persistent)
  const [projectTitle, setProjectTitle] = useState("OSGA-Net: Structure-Aware Bone Age Assessment");
  const [institution, setInstitution] = useState("Department of Computer Science & Medical AI");
  const [leadInvestigator, setLeadInvestigator] = useState("Final-Year Research Scholar");
  const [supervisor, setSupervisor] = useState("Faculty Advisor & Radiologist Collaborator");

  const milestones = [
    {
      id: "M1",
      title: "Mathematical Architecture & Pipeline Implementation",
      description: "Implemented OSGANet with EfficientNetV2-S trunk, 13-landmark soft-argmax head, RoIAlign, per-node FiLM, 2-layer GAT, and 228-bin ordinal head in PyTorch.",
      status: "completed",
    },
    {
      id: "M2",
      title: "Plumbing Verification & Unit Test Harness",
      description: "Verified all forward passes, gradients, checkpoint resume, and API serialization in tests/smoke_test.py and tests/test_aux_equivalence.py.",
      status: "completed",
    },
    {
      id: "M3",
      title: "Interactive Full-Stack Medical Decision Support Workstation",
      description: "Built FastAPI backend with cookie JWT auth, SQLite data isolation, upload validation, ReportLab PDF generation, and React TypeScript workstation UI.",
      status: "completed",
    },
    {
      id: "M4",
      title: "Full RSNA Pediatric Challenge Training on High-VRAM GPU",
      description: "Stage 1 landmark pre-training (20 epochs) + Stage 2 joint training (50 epochs) on full 14,236 image RSNA dataset.",
      status: "pending",
    },
    {
      id: "M5",
      title: "Systematic Ablation Matrix (Table V) & Literature Table Population",
      description: "Execute ablation.py across all 5 configurations, evaluate.py calibration curves, and paired bootstrap significance tests.",
      status: "pending",
    },
    {
      id: "M6",
      title: "Prospective Multi-Center Clinical Validation",
      description: "Multi-center clinical audit across diverse pediatric populations and comparison with multi-rater radiologist consensus.",
      status: "future_scope",
    },
  ];

  const checklist = [
    { item: "Evaluation metric formulas specified (MAE, RMSE, Acc)", value: "Yes (Paper Sec. VI-B)" },
    { item: "Statistical test specified (1,000-sample bootstrap)", value: "Yes (Paper Sec. VI-E)" },
    { item: "Cross-validation protocol (5-fold stratified)", value: "Yes (Paper Sec. VI-F)" },
    { item: "Trained checkpoint shipped in repository", value: "No — Pending Training (Honest Scope)" },
    { item: "Synthetic metrics or simulated results used", value: "Strictly NO (Zero Fabricated Data)" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Project Governance & Research Status</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent academic milestone tracking and Table VIII reproducibility checklist.
          </p>
        </div>
      </div>

      {/* Institutional Metadata Card */}
      <div className="p-5 rounded-xl bg-navy-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-sky-400" />
          <span>Academic & Institutional Attribution</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-500 font-medium block mb-1">Research Project Title</label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-slate-500 font-medium block mb-1">Affiliated Institution</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-slate-500 font-medium block mb-1">Lead Investigator</label>
            <input
              type="text"
              value={leadInvestigator}
              onChange={(e) => setLeadInvestigator(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-slate-500 font-medium block mb-1">Academic Advisor / Supervisor</label>
            <input
              type="text"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Milestones Timeline */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Project Milestone Timeline</h2>
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.id} className="p-4 rounded-xl bg-navy-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 mt-0.5 ${
                    m.status === "completed"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : m.status === "pending"
                      ? "bg-amber-950 text-amber-400 border border-amber-800"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {m.id}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase ${
                    m.status === "completed"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : m.status === "pending"
                      ? "bg-amber-950 text-amber-400 border border-amber-800"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {m.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table VIII: Reproducibility Checklist */}
      <div className="rounded-xl bg-navy-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-white">Table VIII — Paper Reproducibility Checklist</span>
          <span className="text-slate-500 font-mono">IEEE Standards Compliance</span>
        </div>
        <div className="divide-y divide-slate-800/60 text-xs">
          {checklist.map((c, i) => (
            <div key={i} className="p-3.5 flex items-center justify-between gap-4">
              <span className="text-slate-300">{c.item}</span>
              <span className="font-mono text-xs text-sky-400 font-medium">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
