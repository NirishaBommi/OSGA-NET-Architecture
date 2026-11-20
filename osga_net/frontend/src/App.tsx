import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/AppShell";

import { Landing } from "./pages/Landing";
import { MedicalDashboard } from "./pages/MedicalDashboard";
import { ResearchWorkstation } from "./pages/ResearchWorkstation";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { NewAssessment } from "./pages/NewAssessment";
import { AssessmentHistory } from "./pages/AssessmentHistory";
import { StudyViewer } from "./pages/StudyViewer";
import { PreprocessingPage } from "./pages/PreprocessingPage";
import { LandmarksPage } from "./pages/LandmarksPage";
import { RegionalFeaturesPage } from "./pages/RegionalFeaturesPage";
import { FilmModulationPage } from "./pages/FilmModulationPage";
import { GraphAttentionPage } from "./pages/GraphAttentionPage";
import { PredictionPage } from "./pages/PredictionPage";
import { UncertaintyPage } from "./pages/UncertaintyPage";
import { ArchitectureExplorer } from "./pages/ArchitectureExplorer";
import { EvaluationPage } from "./pages/EvaluationPage";
import { AblationsPage } from "./pages/AblationsPage";
import { LiteraturePage } from "./pages/LiteraturePage";
import { ResearchStatusPage } from "./pages/ResearchStatusPage";
import { PresentationMode } from "./pages/PresentationMode";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            {/* Primary Research AI Flagship Dashboard */}
            <Route path="/" element={<ResearchWorkstation />} />
            <Route path="/dashboard" element={<ResearchWorkstation />} />
            <Route path="/research" element={<ResearchWorkstation />} />
            <Route path="/workstation" element={<ResearchWorkstation />} />
            <Route path="/medical" element={<MedicalDashboard />} />
            <Route path="/assess" element={<MedicalDashboard />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Standalone Fullscreen Presentation Mode */}
            <Route
              path="/presentation"
              element={
                <ErrorBoundary>
                  <PresentationMode />
                </ErrorBoundary>
              }
            />

            {/* Workstation Deep-Dive Shell Routes */}
            <Route
              path="/workstation"
              element={
                <AppShell>
                  <Dashboard />
                </AppShell>
              }
            />
            <Route
              path="/assessments/new"
              element={
                <AppShell>
                  <NewAssessment />
                </AppShell>
              }
            />
            <Route
              path="/assessments"
              element={
                <AppShell>
                  <AssessmentHistory />
                </AppShell>
              }
            />

            {/* Per-Study Detailed Clinical & Interpretability Deep Dives */}
            <Route
              path="/assessments/:id/viewer"
              element={
                <AppShell>
                  <StudyViewer />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/preprocessing"
              element={
                <AppShell>
                  <PreprocessingPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/landmarks"
              element={
                <AppShell>
                  <LandmarksPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/regions"
              element={
                <AppShell>
                  <RegionalFeaturesPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/film"
              element={
                <AppShell>
                  <FilmModulationPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/graph"
              element={
                <AppShell>
                  <GraphAttentionPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/prediction"
              element={
                <AppShell>
                  <PredictionPage />
                </AppShell>
              }
            />
            <Route
              path="/assessments/:id/uncertainty"
              element={
                <AppShell>
                  <UncertaintyPage />
                </AppShell>
              }
            />

            {/* Model Architecture Explorer */}
            <Route
              path="/architecture"
              element={
                <AppShell>
                  <ArchitectureExplorer />
                </AppShell>
              }
            />

            {/* Scientific Evaluation, Benchmarks & Literature */}
            <Route
              path="/research/evaluation"
              element={
                <AppShell>
                  <EvaluationPage />
                </AppShell>
              }
            />
            <Route
              path="/research/ablations"
              element={
                <AppShell>
                  <AblationsPage />
                </AppShell>
              }
            />
            <Route
              path="/research/literature"
              element={
                <AppShell>
                  <LiteraturePage />
                </AppShell>
              }
            />
            <Route
              path="/research/status"
              element={
                <AppShell>
                  <ResearchStatusPage />
                </AppShell>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
