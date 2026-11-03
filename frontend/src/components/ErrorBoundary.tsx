import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  compact?: boolean;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Clavis UI boundary caught an error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.compact ? "panel p-7" : "mx-auto max-w-xl px-5 py-24"}>
        <div className={this.props.compact ? "" : "panel p-9 text-center"}>
          <AlertTriangle
            className={`${this.props.compact ? "" : "mx-auto"} h-8 w-8 text-amber-600`}
          />
          <h2 className="mt-4 font-display text-2xl font-semibold">This section needs a retry</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            {this.state.error.message || "An unexpected interface error occurred."}
          </p>
          <button
            type="button"
            className="button-primary mt-5"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }
}
