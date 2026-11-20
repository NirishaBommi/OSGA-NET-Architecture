import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  History,
  Search,
  Filter,
  Trash2,
  Eye,
  FileText,
  PlusCircle,
  AlertCircle,
} from "lucide-react";

import { fetchAssessments, deleteAssessment } from "../services/api";

export const AssessmentHistory: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: assessments = [], isLoading, error } = useQuery({
    queryKey: ["assessments"],
    queryFn: fetchAssessments,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
  });

  const handleDelete = async (id: string) => {
    if (window.confirm(`Delete assessment ${id}? This action is permanent.`)) {
      deleteMutation.mutate(id);
    }
  };

  const filtered = assessments.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Study History & Records</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete audit trail of pediatric bone age assessments and radiological reviews.
          </p>
        </div>
        <Link
          to="/assessments/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shadow-md shadow-sky-500/10"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Assessment</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Study ID or Title..."
            className="w-full bg-navy-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-navy-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="uploaded">Uploaded</option>
            <option value="created">Created</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-navy-900/70 border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading records...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400">Failed to load study history.</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <History className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No studies match your current search or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Study ID</th>
                  <th className="py-3 px-4">Title / Label</th>
                  <th className="py-3 px-4">Sex</th>
                  <th className="py-3 px-4">Chron. Age</th>
                  <th className="py-3 px-4">Ref. Bone Age</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-sky-400">{item.id}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{item.title || "Untitled"}</td>
                    <td className="py-3 px-4 capitalize text-slate-300">{item.patient_sex}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.chronological_age_months ? `${item.chronological_age_months} mo` : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.reference_bone_age_months ? `${item.reference_bone_age_months} mo` : "—"}
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
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/assessments/${item.id}/viewer`}
                          title="Open Workstation Viewer"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {item.status === "completed" && (
                          <a
                            href={`/api/assessments/${item.id}/report`}
                            target="_blank"
                            rel="noreferrer"
                            title="Download Clinical PDF"
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Delete Study"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
