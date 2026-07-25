import React from 'react';
import { History, RotateCcw, Tag, Loader2, Clock, WifiOff } from 'lucide-react';

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)     return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function VersionHistoryPanel({
  history, loading, selectedChar,
  onRestore, onSaveCheckpoint,
  supabaseConnected, T,
}) {
  if (!supabaseConnected) {
    return (
      <div className={`p-6 rounded-xl border text-center space-y-2 ${T.sub}`}>
        <WifiOff className="w-6 h-6 mx-auto opacity-60" />
        <p className="text-xs opacity-70">
          Version History cloud connection අවශ්‍යයි — Supabase configure කරලා නැත්නම් මේක inactive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
          <History className="w-3.5 h-3.5" aria-hidden="true" /> History — &ldquo;{selectedChar}&rdquo;
        </h3>
        <button
          onClick={onSaveCheckpoint}
          aria-label="Save a named checkpoint of the current character"
          className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition ${T.accentBg}`}
        >
          <Tag className="w-3 h-3" aria-hidden="true" /> Save Checkpoint
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className={`w-5 h-5 motion-safe:animate-spin ${T.accent}`} role="status" aria-label="Loading version history" />
        </div>
      )}

      {!loading && history.length === 0 && (
        <p className="text-center py-8 text-xs opacity-60">
          මේ character එකට saved versions නෑ.<br/>Draw කරලා cloud sync වුණාම auto-save වෙයි.
        </p>
      )}

      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
        {history.map((h, i) => (
          <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl border ${T.sub}`}>
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${T.accentBg}`}>
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold truncate">
                {h.label || (i === 0 ? 'Latest auto-save' : 'Auto-save')}
              </div>
              <div className="text-[9px] opacity-70 mt-0.5">
                {timeAgo(h.created_at)} · {h.stroke_count} stroke{h.stroke_count !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => onRestore(h)}
              aria-label={`Restore version from ${timeAgo(h.created_at)}, ${h.stroke_count} strokes`}
              className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0 transition ${T.btn}`}
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> Restore
            </button>
          </div>
        ))}
      </div>

      <p className="text-[8px] opacity-25 text-center pt-1">
        Restoring is itself undoable — Ctrl+Z reverts the restore if needed.
      </p>
    </div>
  );
}
