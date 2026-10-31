import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Label shown in the fallback, e.g. the view name. */
  label?: string;
  /** Changing this value resets the boundary (e.g. the active tab). */
  resetKey?: string | number;
  /** When true the fallback offers a hard reset of saved data. */
  offerDataReset?: boolean;
  onResetData?: () => void;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one broken view never blanks the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PlanGenie] view crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="bg-white border border-rose-200 rounded-3xl p-8 text-center space-y-4 shadow-sm"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            {this.props.label ?? 'This section'} hit a snag
          </h2>
          <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
            Your plan is safe. {this.state.error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
          {this.props.offerDataReset && this.props.onResetData && (
            <button
              type="button"
              onClick={this.props.onResetData}
              className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl"
            >
              Reset saved data
            </button>
          )}
        </div>
      </div>
    );
  }
}
