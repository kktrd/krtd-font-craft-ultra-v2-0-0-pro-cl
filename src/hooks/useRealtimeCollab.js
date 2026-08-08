import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useRealtimeCollab — lightweight multiplayer for KRTD Font Craft.
 * Uses Supabase Realtime Broadcast + Presence (no Postgres table changes needed,
 * works out-of-the-box with just the anon key on any Supabase project).
 *
 * Model: last-stroke-wins. When a local user finishes editing a character,
 * the full stroke array for that character is broadcast to everyone else
 * viewing the same font project. No operational transform / conflict merge —
 * simple, predictable, good enough for small teams co-designing a typeface.
 */

const COLORS = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#818cf8','#e879f9'];
const ADJECTIVES = ['Swift','Bright','Calm','Bold','Quiet','Sharp','Warm','Quick','Steady','Keen'];
const NOUNS = ['Designer','Crafter','Scribe','Artist','Maker','Smith'];

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900 + 100);
  return `${a} ${n} ${num}`;
}

function loadOrCreateIdentity() {
  try {
    const stored = JSON.parse(sessionStorage.getItem('krtd_identity'));
    if (stored?.id) return stored;
  } catch { /* ignore */ }
  const identity = {
    id:    Math.random().toString(36).slice(2, 10),
    name:  randomName(),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  sessionStorage.setItem('krtd_identity', JSON.stringify(identity));
  return identity;
}

export function useRealtimeCollab(supabase, fontName, selectedChar, onRemoteGlyphUpdate) {
  const [collaborators, setCollaborators] = useState([]);
  const channelRef       = useRef(null);
  const identityRef      = useRef(loadOrCreateIdentity());
  // Per-character, TTL-bounded skip map (NOT a plain Set, NOT a single shared
  // boolean): when a remote update for char X is applied locally, only a
  // broadcast attempt for THAT SAME char X, arriving WITHIN A SHORT WINDOW,
  // should be suppressed (it's the immediate echo of applying that same
  // remote data into local state). A single shared boolean was a real bug —
  // it could be consumed by an unrelated broadcast for whatever character
  // the user currently has selected, silently swallowing their own genuine
  // edit. A plain per-char Set (no TTL) fixed that but introduced a subtler
  // staleness bug: if the user later switches TO that same character and
  // makes a genuinely NEW edit — possibly much later — the leftover skip
  // entry (never consumed, since the local broadcast-trigger effect only
  // fires for the currently-selected character) would wrongly suppress that
  // fresh, unrelated edit too. The TTL bounds the entry's lifetime so it can
  // only ever suppress the one immediate echo it was created for.
  const skipBroadcastCharsRef = useRef(new Map()); // char -> timestamp
  const SKIP_TTL_MS = 2000;

  const shouldSkipAndConsume = (char) => {
    const ts = skipBroadcastCharsRef.current.get(char);
    if (ts === undefined) return false;
    skipBroadcastCharsRef.current.delete(char); // always consume on check — never linger
    return (Date.now() - ts) < SKIP_TTL_MS;
  };

  // ── Subscribe to channel for this font project ──────────────────────────
  useEffect(() => {
    if (!supabase || !fontName) { setCollaborators([]); return; }

    const channel = supabase.channel(`collab:${fontName}`, {
      config: { presence: { key: identityRef.current.id } },
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const list = Object.values(state)
        .flat()
        .filter((p) => p?.id); // guard malformed entries
      setCollaborators(list);
    });

    channel.on('broadcast', { event: 'glyph-update' }, ({ payload }) => {
      if (!payload || payload.senderId === identityRef.current.id) return;
      skipBroadcastCharsRef.current.set(payload.char, Date.now());
      onRemoteGlyphUpdate?.(payload.char, payload.strokes);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ ...identityRef.current, char: selectedChar });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fontName]);

  // ── Update presence when selected character changes ─────────────────────
  useEffect(() => {
    channelRef.current?.track({ ...identityRef.current, char: selectedChar });
  }, [selectedChar]);

  // ── Broadcast a local glyph change to peers ──────────────────────────────
  const broadcastGlyphUpdate = useCallback((char, strokes) => {
    if (shouldSkipAndConsume(char)) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'glyph-update',
      payload: { char, strokes, senderId: identityRef.current.id },
    });
  }, []);

  return {
    collaborators,        // [{id,name,color,char}, ...] — includes self
    broadcastGlyphUpdate,
    identity: identityRef.current,
    onlineCount: collaborators.length,
  };
}
