import React from 'react';

/**
 * ErrorBoundary — catches render errors in any child subtree.
 * Prevents a single bad glyph / corrupted JSON from crashing the whole app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[KRTD ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { T } = this.props;
    const card   = T?.card   || 'bg-white border-slate-200';
    const accent = T?.accent || 'text-indigo-600';
    const btn    = T?.btn    || 'bg-indigo-600 text-white';

    return (
      <div className={`min-h-[300px] flex flex-col items-center justify-center p-8 rounded-2xl border m-4 text-center space-y-4 ${card}`}>
        <div className="text-4xl">⚠️</div>
        <div>
          <h3 className="font-black text-lg mb-1">Render Error</h3>
          <p className="text-sm opacity-50 max-w-sm mx-auto">
            Component crash වුනා. Corrupted glyph data එකක් හෝ storage issue ඇති විය හැකිය.
          </p>
        </div>
        <code className={`text-[10px] px-3 py-2 rounded-lg border max-w-xs break-all opacity-60 ${card}`}>
          {this.state.error?.message || 'Unknown error'}
        </code>
        <div className="flex gap-3">
          <button
            onClick={this.handleReset}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${btn}`}
          >
            Retry
          </button>
          <button
            onClick={() => { localStorage.removeItem('krtd_font_craft_glyphs'); window.location.reload(); }}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-500"
          >
            Reset Storage
          </button>
        </div>
      </div>
    );
  }
}
