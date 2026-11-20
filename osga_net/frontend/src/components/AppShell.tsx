import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  LayoutDashboard,
  PlusCircle,
  History,
  Eye,
  Sliders,
  Cpu,
  MapPin,
  Box,
  Layers,
  Share2,
  TrendingUp,
  ShieldAlert,
  BarChart2,
  Table,
  BookOpen,
  Info,
  FileText,
  Presentation,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

import { fetchModelStatus, fetchCurrentUser, logout } from "../services/api";
import { ModeBadge } from "./ModeBadge";
import { DisclaimerBanner } from "./DisclaimerBanner";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Parse assessment id from URL if on an assessment route: /assessments/:id/...
  const match = location.pathname.match(/\/assessments\/([^\/]+)/);
  const activeAssessmentId = match && match[1] !== "new" ? match[1] : null;

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
    refetchInterval: 30000,
  });

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
  });

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch {
      navigate("/login");
    }
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
      isActive
        ? "bg-sky-500/15 text-sky-400 font-semibold border-l-2 border-sky-400 pl-2.5 shadow-sm"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
    }`;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Workstation Top Header */}
      <header className="h-14 bg-navy-900 border-b border-slate-800/80 px-4 flex items-center justify-between select-none z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-inner">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-slate-100">OSGA-Net</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-medium">Workstation</span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Structure-Aware Pediatric Bone Age Assessment</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ModeBadge mode={status?.mode} />
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-medium text-slate-200 leading-none">{user.full_name || user.username}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Workspace Body (Sidebar + Viewport) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 transition-transform duration-200 absolute md:static inset-y-14 left-0 w-64 bg-navy-950 border-r border-slate-800/80 flex flex-col z-20 overflow-y-auto`}
        >
          <div className="p-3 space-y-6">
            {/* Group 1: Clinical Assessment */}
            <div>
              <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Clinical Workflow</p>
              <nav className="space-y-0.5">
                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <Link to="/assessments/new" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/assessments/new")}>
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>New Assessment</span>
                </Link>
                <Link to="/assessments" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/assessments")}>
                  <History className="w-4 h-4" />
                  <span>Study History</span>
                </Link>
              </nav>
            </div>

            {/* Group 2: Model Deep Dives & Interpretability */}
            <div>
              <div className="flex items-center justify-between px-3 mb-1">
                <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Model Internals & XAI</p>
                {activeAssessmentId && (
                  <span className="text-[9px] font-mono px-1 bg-sky-950 text-sky-400 rounded border border-sky-800">
                    {activeAssessmentId.slice(0, 10)}
                  </span>
                )}
              </div>
              <nav className="space-y-0.5">
                <Link to="/architecture" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/architecture")}>
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>Architecture Explorer</span>
                </Link>
                {activeAssessmentId ? (
                  <>
                    <Link to={`/assessments/${activeAssessmentId}/viewer`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/viewer`)}>
                      <Eye className="w-4 h-4 text-sky-400" />
                      <span>Imaging Workspace</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/preprocessing`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/preprocessing`)}>
                      <Sliders className="w-4 h-4" />
                      <span>Preprocessing Steps</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/landmarks`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/landmarks`)}>
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span>13 Landmarks & Heatmaps</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/regions`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/regions`)}>
                      <Box className="w-4 h-4" />
                      <span>Regional RoI Pooling</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/film`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/film`)}>
                      <Layers className="w-4 h-4" />
                      <span>FiLM Modulation</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/graph`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/graph`)}>
                      <Share2 className="w-4 h-4 text-teal-400" />
                      <span>Graph Attention (GAT)</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/prediction`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/prediction`)}>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Ordinal Prediction & Bins</span>
                    </Link>
                    <Link to={`/assessments/${activeAssessmentId}/uncertainty`} onClick={() => setMobileMenuOpen(false)} className={navItemClass(`/assessments/${activeAssessmentId}/uncertainty`)}>
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>Uncertainty & Triage</span>
                    </Link>
                  </>
                ) : (
                  <div className="px-3 py-2 text-[11px] text-slate-500 italic bg-slate-900/40 rounded border border-slate-800/40">
                    Select a study from History or Dashboard to inspect deep-dive layers.
                  </div>
                )}
              </nav>
            </div>

            {/* Group 3: Scientific Benchmarks */}
            <div>
              <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Scientific Benchmarks</p>
              <nav className="space-y-0.5">
                <Link to="/research/evaluation" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/research/evaluation")}>
                  <BarChart2 className="w-4 h-4 text-sky-400" />
                  <span>Evaluation Dashboard</span>
                </Link>
                <Link to="/research/ablations" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/research/ablations")}>
                  <Table className="w-4 h-4" />
                  <span>Ablation Matrix (Table V)</span>
                </Link>
                <Link to="/research/literature" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/research/literature")}>
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Literature Comparison (Table IV)</span>
                </Link>
                <Link to="/research/status" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/research/status")}>
                  <Info className="w-4 h-4" />
                  <span>Project Status & Timeline</span>
                </Link>
              </nav>
            </div>

            {/* Group 4: Presentation & Reports */}
            <div>
              <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Presentation & Export</p>
              <nav className="space-y-0.5">
                {activeAssessmentId && (
                  <a
                    href={`/api/assessments/${activeAssessmentId}/report`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Download Clinical PDF</span>
                  </a>
                )}
                <Link to="/presentation" onClick={() => setMobileMenuOpen(false)} className={navItemClass("/presentation")}>
                  <Presentation className="w-4 h-4 text-amber-400" />
                  <span>11-Stage Presentation Mode</span>
                </Link>
              </nav>
            </div>
          </div>
        </aside>

        {/* Viewport content */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* 3. Bottom Disclaimer Banner */}
      <DisclaimerBanner />
    </div>
  );
};
