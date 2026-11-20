import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PlusCircle,
  Upload,
  AlertCircle,
  FileText,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Sliders,
} from "lucide-react";

import { createAssessment, uploadAssessmentImage, runInference, runDemoInference, fetchModelStatus } from "../services/api";

export const NewAssessment: React.FC = () => {
  const navigate = useNavigate();

  const { data: status } = useQuery({
    queryKey: ["modelStatus"],
    queryFn: fetchModelStatus,
  });

  // Step state: 1 (Metadata) -> 2 (Upload) -> 3 (Trigger Inference)
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [patientSex, setPatientSex] = useState<"male" | "female">("male");
  const [chronologicalAge, setChronologicalAge] = useState<string>("");
  const [referenceAge, setReferenceAge] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Created assessment
  const [createdAssessmentId, setCreatedAssessmentId] = useState<string | null>(null);

  // Selected file & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCreateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const chronMonths = chronologicalAge ? parseFloat(chronologicalAge) : undefined;
      const refMonths = referenceAge ? parseFloat(referenceAge) : undefined;

      const created = await createAssessment({
        title: title || undefined,
        patient_sex: patientSex,
        chronological_age_months: chronMonths,
        reference_bone_age_months: refMonths,
        notes: notes || undefined,
      });

      setCreatedAssessmentId(created.id);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!createdAssessmentId || !selectedFile) {
      setError("Please select a radiograph file to upload.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await uploadAssessmentImage(createdAssessmentId, selectedFile);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Upload failed. Ensure file is a valid PNG or JPEG.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunInference = async (isDemo = false) => {
    if (!createdAssessmentId) return;
    setError(null);
    setLoading(true);
    try {
      if (isDemo) {
        await runDemoInference(createdAssessmentId);
      } else {
        await runInference(createdAssessmentId);
      }
      navigate(`/assessments/${createdAssessmentId}/viewer`);
    } catch (err: any) {
      setError(err.message || "Inference execution failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-navy-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step >= 1 ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              1
            </span>
            <span className={step === 1 ? "text-white font-semibold" : "text-slate-400"}>Metadata</span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-800 mx-3" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step >= 2 ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              2
            </span>
            <span className={step === 2 ? "text-white font-semibold" : "text-slate-400"}>Upload X-Ray</span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-800 mx-3" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step >= 3 ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              3
            </span>
            <span className={step === 3 ? "text-white font-semibold" : "text-slate-400"}>Inference</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Metadata Form */}
        {step === 1 && (
          <form onSubmit={handleCreateMetadata} className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Study & Patient Clinical Details</h2>
              <p className="text-xs text-slate-400">Specify biological sex and optional clinical reference markers.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Study Title / Label</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Case #1024 - Left Hand Radiograph"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Biological Sex <span className="text-rose-400">*</span>
                </label>
                <select
                  value={patientSex}
                  onChange={(e) => setPatientSex(e.target.value as "male" | "female")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Chronological Age (months)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="240"
                  value={chronologicalAge}
                  onChange={(e) => setChronologicalAge(e.target.value)}
                  placeholder="e.g. 132.0 (11 years)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Note on Chronological Age conditioning */}
            <div className="p-3 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>FiLM Conditioning Note:</strong> RSNA Pediatric Challenge data does not include chronological age. FiLM is conditioned on biological sex by default. Entering chronological age allows discrepancy reporting without modifying model weights.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reference Bone Age (months) <span className="text-slate-500">(Optional Ground Truth)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="240"
                value={referenceAge}
                onChange={(e) => setReferenceAge(e.target.value)}
                placeholder="e.g. 136.0 (Radiologist consensus)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Diagnostic indication, endocrinology context, or growth notes..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors"
              >
                <span>{loading ? "Creating..." : "Proceed to Upload"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Radiograph Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Upload Hand Radiograph (X-Ray)</h2>
              <p className="text-xs text-slate-400">
                Supports standard PNG and JPEG hand radiographs. De-identified clinical files only.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950 relative">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    {selectedFile ? selectedFile.name : "Click to select or drag and drop hand radiograph"}
                  </p>
                  <p className="text-[11px] text-slate-500">PNG or JPEG up to 15 MB (min 128x128 px)</p>
                </div>
              </div>
            </div>

            {previewUrl && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
                <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded border border-slate-800" />
                <div className="text-xs">
                  <p className="font-medium text-slate-200">{selectedFile?.name}</p>
                  <p className="text-slate-500 text-[11px]">{((selectedFile?.size || 0) / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selectedFile || loading}
                onClick={handleUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                <span>{loading ? "Uploading & Validating..." : "Upload & Validate"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Inference Trigger */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Execute Skeletal Age Inference</h2>
              <p className="text-xs text-slate-400">Radiograph validated successfully. Ready for evaluation.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Model Checkpoint Status:</span>
                <span className={status?.checkpoint_loaded ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {status?.checkpoint_loaded ? "Trained Checkpoint Ready" : "No Checkpoint Loaded"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {status?.checkpoint_loaded
                  ? "Run real PyTorch inference using the loaded OSGA-Net model weights."
                  : "Because no trained checkpoint is located in runs/osga/best.pt, you can run Demonstration Mode with clearly labelled mock outputs for interface evaluation and viva defense."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {status?.checkpoint_loaded ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleRunInference(false)}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? "Running PyTorch Inference..." : "Run Real Inference"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleRunInference(true)}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? "Generating Demo..." : "Run in Demonstration Mode"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
