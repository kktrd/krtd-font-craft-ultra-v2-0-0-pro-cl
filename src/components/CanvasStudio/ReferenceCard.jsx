import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Camera, Trash2, Eye, EyeOff, Move, RotateCcw } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import { REF_LIMITS, setRef, clearRef, resetRefTransform, readImageFile } from '../../utils/referenceArt.js';

// Reference Artwork: upload a handwriting / lettering photo, trace over it on the canvas.
export default function ReferenceCard({ T, art, toast }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const src = await readImageFile(f);
      setRef({ src, visible: true, adjust: true, scale: 100, x: 0, y: 0, rot: 0, flip: false });
      toast && toast('Reference පින්තූරය දැම්මා — ඇදලා/pinch කරලා හරියටම ගලපන්න', 'success');
    } catch (err) { toast && toast(err.message || 'පින්තූරය දාන්න බැරි වුණා', 'error'); }
    finally { setBusy(false); }
  };

  const has = !!art.src;
  const btn = `px-2.5 py-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40 inline-flex items-center gap-1.5 ${T.btnGhost}`;
  const Row = ({ label, k, range, unit = '' }) => (
    <label className="flex items-center gap-2">
      <span className="w-16 flex-shrink-0 opacity-80">{label}</span>
      <input type="range" min={range[0]} max={range[1]} value={art[k]} disabled={!has}
        onChange={(e) => setRef({ [k]: Number(e.target.value) })} className="flex-1 min-w-[80px] w-full" aria-label={label} />
      <span className="w-12 text-right tabular-nums font-bold">{art[k]}{unit}</span>
    </label>
  );

  return (
    <Collapsible id="refart" title="REFERENCE ARTWORK" si="reference පින්තූරය" icon={ImageIcon} T={T}
      summary={has ? (art.visible ? `on · ${art.opacity}%` : 'hidden') : 'none'}>
      <div className="space-y-3 text-xs font-semibold">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} aria-label="Upload reference image" />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take reference photo" />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> {has ? 'වෙනත් පින්තූරයක්' : 'Handwriting පින්තූරය දාන්න'}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => camRef.current && camRef.current.click()}>
            <Camera className="w-3.5 h-3.5" aria-hidden="true" /> Photo ගන්න
          </button>
        </div>

        {!has && <p className="opacity-70 font-medium leading-snug">අතින් ලියපු අකුරු / පැරණි අකුරු පින්තූරයක් දාන්න. එය canvas එක උඩින් අඳුරු කඩදාසියක් වගේ පෙනෙනවා — ඒ උඩින් ඇඳලා font එක හදන්න. (පින්තූරය font එකට යන්නේ නැහැ.)</p>}

        {has && (
          <>
            <div className="flex items-center gap-2">
              <img src={art.src} alt="Reference thumbnail" className="w-14 h-14 object-cover rounded-lg border" />
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={btn} aria-pressed={art.visible} onClick={() => setRef({ visible: !art.visible })}>
                  {art.visible ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />} {art.visible ? 'පෙන්වයි' : 'සඟවා'}
                </button>
                <button type="button" className={`${btn} ${art.adjust ? T.btn : ''}`} aria-pressed={art.adjust} onClick={() => setRef({ adjust: !art.adjust, visible: true })}>
                  <Move className="w-3.5 h-3.5" aria-hidden="true" /> {art.adjust ? 'ගැලපීම ඉවරයි' : 'ඇදලා ගලපන්න'}
                </button>
              </div>
            </div>
            {art.adjust && <p className="opacity-70 font-medium leading-snug">Canvas එක උඩ ඇඟිල්ලෙන් ඇදන්න = ගෙනයන්න · ඇඟිලි දෙකකින් pinch = ලොකු/පොඩි (mouse wheel එකත් හරි). ඉවර වුණාම “ගැලපීම ඉවරයි” ඔබන්න, එතකොට ඇඳීම පටන් ගන්න පුළුවන්.</p>}
            <div className="space-y-1.5">
              <Row label="Opacity" k="opacity" range={REF_LIMITS.opacity} unit="%" />
              <Row label="Size" k="scale" range={REF_LIMITS.scale} unit="%" />
              <Row label="Move X" k="x" range={REF_LIMITS.move} />
              <Row label="Move Y" k="y" range={REF_LIMITS.move} />
              <Row label="Rotate" k="rot" range={REF_LIMITS.rot} unit="°" />
              <Row label="Contrast" k="contrast" range={REF_LIMITS.contrast} unit="%" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={art.gray} onChange={(e) => setRef({ gray: e.target.checked })} /> Gray</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={art.invert} onChange={(e) => setRef({ invert: e.target.checked })} /> Invert</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={art.flip} onChange={(e) => setRef({ flip: e.target.checked })} /> Mirror ↔</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} onClick={resetRefTransform}><RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset</button>
              <button type="button" className={btn} onClick={() => { clearRef(); toast && toast('Reference ඉවත් කළා', 'success'); }}><Trash2 className="w-3 h-3" aria-hidden="true" /> ඉවත් කරන්න</button>
            </div>
          </>
        )}
      </div>
    </Collapsible>
  );
}
