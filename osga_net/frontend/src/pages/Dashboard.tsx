import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  PlusCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Clock,
  ArrowRight,
  TrendingUp,
  FolderOpen,
} from "lucide-react";

import { fetchAssessments, fetchModelStatus } from "../services/api";
import { ModeBadge } from "../components/ModeBadge";

export const Dashboard: React.FC = () => {
  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ["assessments"],
    queryFn: fetchAssessments,
  });

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  const totalStudies = assessments.length;
  const completedStudies = assessments.filter((a) => a.status === "completed").length;
  const pendingStudies = assessments.filter((a) => a.status === "created" || a.status === "uploaded").length;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Clinical Workstation Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Overview of pediatric bone age studies, model status, and recent radiological reviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/assessments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shadow-md shadow-sky-500/10"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* 2. Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Studies</span>
            <FolderOpen className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalStudies}</span>
            <span className="text-[11px] text-slate-500">recorded</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Completed Inferences</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{completedStudies}</span>
            <span className="text-[11px] text-slate-500">evaluated</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Pending Upload / Inference</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{pendingStudies}</span>
            <span className="text-[11px] text-slate-500">awaiting</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Model Runtime</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="pt-0.5">
            <ModeBadge mode={status?.mode} />
          </div>
        </div>
      </div>

      {/* 3. Checkpoint Status Card */}
      <div className="p-4 rounded-xl bg-navy-900/50 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Model Environment</span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-mono text-sky-400">
              {status?.checkpoint_loaded ? "Checkpoint Loaded" : "No Checkpoint Found"}
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {status?.checkpoint_loaded
              ? `Loaded weights from ${status.checkpoint_path} on ${status.device.toUpperCase()}. Operating with input dimension ${status.img_size}x${status.img_size}.`
              : "No trained checkpoint found in runs/osga/best.pt. The system operates in Demonstration Mode for viva walkthroughs, and shows empty state placeholders in evaluation dashboards."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/architecture"
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Inspect Layers
          </Link>
          <Link
            to="/presentation"
            className="px-3 py-1.5 rounded bg-sky-950 border border-sky-800 text-sky-300 text-xs font-medium hover:bg-sky-900 transition-colors"
          >
            Presentation Mode
          </Link>
        </div>
      </div>

      {/* 4. Recent Studies Table */}
      <div className="rounded-xl bg-navy-900/70 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Bone Age Assessments</h2>
          <Link to="/assessments" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingAssessments ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400">No assessments created yet.</p>
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create First Assessment</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-2.5 px-4">Study ID</th>
                  <th className="py-2.5 px-4">Title</th>
                  <th className="py-2.5 px-4">Patient Sex</th>
                  <th className="py-2.5 px-4">Chronological Age</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assessments.slice(0, 6).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-sky-400">{item.id}</td>
                    <td className="py-3 px-4 text-slate-200">{item.title || "Untitled Study"}</td>
                    <td className="py-3 px-4 capitalize text-slate-300">{item.patient_sex}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.chronological_age_months ? `${item.chronological_age_months} mo` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium capitalize ${
                          item.status === "completed"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : item.status === "uploaded"
                            ? "bg-sky-950 text-sky-400 border border-sky-800"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/assessments/${item.id}/viewer`}
                        className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                      >
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
