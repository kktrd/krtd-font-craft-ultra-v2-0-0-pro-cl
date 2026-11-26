import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Camera, Trash2, Eye, EyeOff, Move, RotateCcw } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import { REF_LIMITS, setRef, clearRef, resetRefTransform, readImageFile } from '../../utils/referenceArt.js';
import { traceReference, paintMaskPreview } from '../../utils/traceReference.js';
import { TRACE_DEFAULTS } from '../../utils/traceImage.js';

// Reference Artwork: upload a handwriting / lettering photo, trace over it on the canvas.
export default function ReferenceCard({ T, art, toast, glyphs, setGlyphs, selectedChar, strokeWidth }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [tr, setTr] = useState({ sensitivity: TRACE_DEFAULTS.sensitivity, smooth: TRACE_DEFAULTS.smooth, spur: TRACE_DEFAULTS.spur, useBrush: false, add: false });
  const [backup, setBackup] = useState(null);
  const maskRef = useRef(null);

  useEffect(() => {                                   // live "what counts as ink" preview
    if (!art.src || !maskRef.current) return undefined;
    const id = setTimeout(() => { paintMaskPreview(art, tr.sensitivity, maskRef.current).catch(() => {}); }, 120);
    return () => clearTimeout(id);
  }, [art.src, art.scale, art.x, art.y, art.rot, art.flip, art.contrast, art.invert, tr.sensitivity]);

  const runTrace = async () => {
    setBusy(true);
    try {
      const r = await traceReference(art, { sensitivity: tr.sensitivity, smooth: tr.smooth, spur: tr.spur, fixedWidth: tr.useBrush ? strokeWidth : 0 });
      if (!r.strokes.length) { toast && toast('අකුරු හොයාගන්න බැරි වුණා — Sensitivity / Contrast වෙනස් කරලා බලන්න', 'info'); return; }
      const old = glyphs[selectedChar] || [];
      setBackup({ prev: old, char: selectedChar });
      setGlyphs({ ...glyphs, [selectedChar]: tr.add ? [...old, ...r.strokes] : r.strokes });
      setRef({ adjust: false });
      toast && toast(`✅ “${selectedChar}” — strokes ${r.strokes.length}ක් trace වුණා (Undo කරන්න පුළුවන්)`, 'success');
    } catch (err) { toast && toast(err.message || 'Trace කරන්න බැරි වුණා', 'error'); }
    finally { setBusy(false); }
  };
  const undoTrace = () => {
    if (!backup) return;
    setGlyphs({ ...glyphs, [backup.char]: backup.prev });
    setBackup(null);
    toast && toast('Trace එක ආපසු හැරෙව්වා', 'success');
  };

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
              <button type="button" className={btn} onClick={() => { clearRef(); setBackup(null); toast && toast('Reference ඉවත් කළා', 'success'); }}><Trash2 className="w-3 h-3" aria-hidden="true" /> ඉවත් කරන්න</button>
            </div>
            <div className={`rounded-xl border p-2.5 space-y-2 ${T.sub}`}>
              <div className="font-black text-[11px] tracking-wide">AUTO-TRACE <span className="opacity-70 font-semibold">ස්වයංක්‍රීයව strokes බවට</span></div>
              <div className="flex gap-3 items-start">
                <canvas ref={maskRef} width={110} height={110} className="rounded-lg border flex-shrink-0 bg-white" aria-label="Ink preview" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <label className="flex items-center gap-2"><span className="w-16 flex-shrink-0 opacity-80">Ink</span>
                    <input type="range" min={-60} max={60} value={tr.sensitivity} onChange={(e) => setTr({ ...tr, sensitivity: Number(e.target.value) })} className="flex-1 min-w-[60px] w-full" aria-label="Ink sensitivity" />
                    <span className="w-8 text-right tabular-nums font-bold">{tr.sensitivity}</span></label>
                  <label className="flex items-center gap-2"><span className="w-16 flex-shrink-0 opacity-80">Smooth</span>
                    <input type="range" min={1} max={6} step={0.5} value={tr.smooth} onChange={(e) => setTr({ ...tr, smooth: Number(e.target.value) })} className="flex-1 min-w-[60px] w-full" aria-label="Smoothness" />
                    <span className="w-8 text-right tabular-nums font-bold">{tr.smooth}</span></label>
                  <label className="flex items-center gap-2"><span className="w-16 flex-shrink-0 opacity-80">Spurs</span>
                    <input type="range" min={4} max={40} value={tr.spur} onChange={(e) => setTr({ ...tr, spur: Number(e.target.value) })} className="flex-1 min-w-[60px] w-full" aria-label="Remove short branches" />
                    <span className="w-8 text-right tabular-nums font-bold">{tr.spur}</span></label>
                </div>
              </div>
              <p className="opacity-70 font-medium leading-snug">කළු පෙනෙන්නේ ink ලෙස ගන්න කොටස්. අකුර කළුවට පැහැදිලිව පෙනෙනකම් Ink / Contrast හදන්න. Trace වෙන්නේ canvas එකේ පේන කොටස විතරයි.</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={tr.useBrush} onChange={(e) => setTr({ ...tr, useBrush: e.target.checked })} /> මගේ brush පළල ({strokeWidth})</label>
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={tr.add} onChange={(e) => setTr({ ...tr, add: e.target.checked })} /> තියෙන strokes වලට එකතු කරන්න</label>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" disabled={busy} onClick={runTrace} className={`px-3 py-2 rounded-xl text-[11px] font-black disabled:opacity-50 ${T.btn}`}>{busy ? '…' : `“${selectedChar}” ට Trace කරන්න`}</button>
                {backup && <button type="button" onClick={undoTrace} className={btn}><RotateCcw className="w-3 h-3" aria-hidden="true" /> Undo trace</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </Collapsible>
  );
}
