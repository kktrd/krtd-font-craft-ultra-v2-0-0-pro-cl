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
  const skipBroadcastRef = useRef(false);

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
      skipBroadcastRef.current = true;
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
    if (skipBroadcastRef.current) { skipBroadcastRef.current = false; return; }
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
