import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught workstation error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-200">
          <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800 flex items-center justify-center mb-4 text-rose-400">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Workstation Interface Error</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            An unexpected error occurred in this workstation view. Please reset or reload the component.
          </p>
          <pre className="text-xs font-mono bg-slate-900 border border-slate-800 p-3 rounded max-w-lg overflow-x-auto text-rose-300 mb-6 text-left">
            {this.state.error?.message || "Unknown error"}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-sm font-medium transition-colors shadow"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Component</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
