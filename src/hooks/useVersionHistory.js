import { useState, useCallback } from 'react';

/**
 * useVersionHistory — fetch / save / restore glyph snapshots from Supabase.
 * Works alongside the existing localStorage + cloud-sync layers; this is a
 * separate append-only log so past states are never silently overwritten.
 */
export function useVersionHistory(supabase, fontName, ownerId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (char) => {
    if (!supabase || !fontName || !char) { setHistory([]); return; }
    setLoading(true);
    try {
      let q = supabase
        .from('glyph_history')
        .select('id, strokes, stroke_count, label, user_id, created_at')
        .eq('font_name', fontName)
        .eq('glyph_char', char);
      if (ownerId) q = q.in('user_id', [ownerId, 'guest']);   // my snapshots (+ old shared-guest ones)
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setHistory(data);
      else setHistory([]);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, fontName, ownerId]);

  const saveSnapshot = useCallback(async (char, strokes, userId, label = null) => {
    if (!supabase || !fontName || !char || !strokes?.length) return false;
    try {
      const { error } = await supabase.from('glyph_history').insert({
        font_name:    fontName,
        glyph_char:   char,
        strokes,
        stroke_count: strokes.length,
        label,
        user_id:      userId || ownerId,
      });
      return !error;
    } catch {
      return false;
    }
  }, [supabase, fontName, ownerId]);

  return { history, loading, loadHistory, saveSnapshot };
}
