import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold text-slate-900">Something went wrong</p>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            {this.state.error.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
