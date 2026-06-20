import React from 'react';
import { Users } from 'lucide-react';

/**
 * CollabPresence — slim strip showing who else is co-designing this font
 * right now, and which character they're currently working on.
 */
export default function CollabPresence({ collaborators, selfId, T }) {
  if (!collaborators || collaborators.length <= 1) return null;

  const others = collaborators.filter((c) => c.id !== selfId);
  if (others.length === 0) return null;

  return (
    <div className={`max-w-[1600px] mx-auto px-3 md:px-5 lg:px-6 pt-3`}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold overflow-x-auto ${T.sub}`}>
        <Users className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
        <span className="opacity-40 flex-shrink-0">Online now:</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {others.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${c.color}1a`, border: `1px solid ${c.color}40` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                style={{ backgroundColor: c.color }}
              />
              <span style={{ color: c.color }}>{c.name}</span>
              {c.char && (
                <span className="opacity-50 font-sinhala">on &ldquo;{c.char}&rdquo;</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
