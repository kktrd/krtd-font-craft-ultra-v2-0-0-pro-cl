# KRTD Font Craft Ultra — v2.0.0 PRO

**Production-grade Sinhala Font Design Studio**  
© 2026 Prabhath Lokuge / KRTD Studio. All rights reserved.

---

## ⚡ Quick Deploy (5 minutes)

### Step 1 — Supabase Setup
1. Go to [supabase.com](https://supabase.com) → New Project
2. Dashboard → **SQL Editor** → paste entire `fontcraft-db-schema.sql` → Run
3. Go to **Settings → API** → copy `Project URL` and `anon public` key

### Step 2 — GitHub
1. Create new GitHub repo (private recommended)
2. Upload all project files into repo root
3. Make sure `.env` is **NOT** committed (it's in `.gitignore`)

### Step 3 — Vercel Deploy
1. [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. Framework: **Vite** (auto-detected)
3. Add Environment Variables:
   ```
   VITE_SUPABASE_URL       = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJhbGc...
   ```
4. Click **Deploy** ✅

### Step 4 — Create Admin User
1. Supabase → **Authentication → Users** → Invite User (your email)
2. After confirming email, get your UUID from the Users table
3. SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role, granted_by)
   VALUES ('YOUR-UUID-HERE', 'super_admin', 'system')
   ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
   ```

---

## 🗂 Project Structure

```
src/
├── App.jsx                          # Root controller
├── main.jsx
├── index.css
├── hooks/
│   └── useWindowSize.js             # Responsive breakpoint hook
├── utils/
│   ├── transliteration.js           # Singlish → Sinhala engine v2.2
│   ├── rdpSimplifier.js             # RDP path compression
│   ├── trieEngine.js                # Word prediction trie
│   ├── themeTokens.js               # Design token system
│   ├── glyphData.js                 # Sinhala character sets
│   └── security.js                  # Copyright protection
└── components/
    ├── Shared/
    │   ├── Header.jsx
    │   ├── Footer.jsx
    │   └── ErrorBoundary.jsx        # Crash recovery
    ├── CanvasStudio/
    │   ├── CanvasWorkspace.jsx      # Drawing engine
    │   ├── AtlasMatrix.jsx          # Character selector
    │   ├── MetricsEngine.jsx        # Font metrics + cloud
    │   └── BottomSheetDrawer.jsx    # Mobile overlay
    ├── TextStudio/
    │   ├── TextStudioWorkspace.jsx  # Text editor
    │   ├── SuggestionBar.jsx        # Trie prediction UI
    │   └── FontTestDrive.jsx        # Vector preview canvas
    └── Admin/
        └── AdminDashboard.jsx       # Admin console
```

---

## ⌨️ Keyboard Shortcuts (Canvas Studio)

| Key | Action |
|-----|--------|
| `B` | Switch to Brush |
| `E` | Switch to Eraser |
| `M` | Toggle Metric lines |
| `S` | Toggle Snap to grid |
| `[ / ]` | Decrease / Increase stroke size |
| `1` `2` `3` `4` | Zoom 1x / 1.5x / 2x / 3x |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

---

## 🔐 Auth Tiers

| Tier | Access |
|------|--------|
| Guest | Canvas draw, text studio, local save only |
| Designer | All above + Supabase cloud sync |
| Admin | All above + Admin dashboard, delete projects |
| Super Admin | All above + Manage user roles |

---

## 🚀 Roadmap

- [ ] OTF/TTF binary compiler
- [ ] AI handwriting auto-trace
- [ ] WebSocket collaborative sessions
- [ ] Next-word cloud prediction API

---

*Unauthorized code duplication or redistribution is strictly prohibited.*


---

## 🆕 v2.1 — Next-Level Features

### 1. Real TTF Font Export
Canvas strokes are now converted into true closed vector outlines (centerline + width →
offset polygon) and compiled into an installable `.ttf` file using `opentype.js` — 100%
in-browser, no server or CLI. Works in Word, Canva, Photoshop, and any OS font manager.

### 2. Mirror / Symmetry Draw Mode
Press `X` or click **Mirror** in Canvas Studio. A pink axis line appears at the
horizontal center; every stroke you draw is automatically mirrored to the opposite side
in real time — perfect for symmetric Sinhala loops (ක, ට, ඩ, ආ).

### 3. Installable PWA
The app now ships a `manifest.webmanifest`, app icons, and a service worker
(`public/sw.js`). On Android/Desktop Chrome/Edge, an **Install** button appears in the
header. On iOS Safari, use Share → "Add to Home Screen" (no native prompt API on iOS).
Works offline after first visit — cached app shell + static assets.

### 4. Real-time Multiplayer Collaboration
Uses Supabase Realtime **Broadcast + Presence** (no extra SQL setup — works out of the
box with your existing anon key). Open the same font project in two browser tabs/devices:
- See who else is online and which character they're editing (header badge + presence strip)
- Finished strokes sync instantly to all connected collaborators
- Model: last-stroke-wins (simple, predictable — no operational transform)

---


---

## 🏗️ v3.0 — Safe Production Upgrade (Step 0 Architecture + Parts 1-4)

### Step 0 — Rollback Architecture
- `src/utils/featureFlags.js` — every V3 module is gated by a boolean flag.
  Flip any flag to `false` and that module reverts to v2.0 PRO baseline
  behavior instantly, with zero code deletion required.
- v2.0 PRO core (themes, Supabase sync, JSON backup, Trie tokenizer) never
  reads these flags — disabling everything always returns the exact v2.0
  PRO experience.
- Recommended Git flow: keep `main` as the live v2.0 PRO baseline, do this
  work on a `v3-upgrade` branch, use Vercel's automatic Preview Deployment
  per-branch URL for QA, merge only after manual verification.

### Part 1 — Translation Engine
| Feature | File | Notes |
|---|---|---|
| Web Worker transliteration | `workers/transliteration.worker.js`, `hooks/useTransliterationWorker.js` | Off-thread Singlish→Sinhala. Falls back to sync main-thread automatically if Workers are unsupported. |
| Legacy ASCII converter | `utils/legacyEncoding.js` | **KRTD-Legacy-Reference-v1** — a clearly-labeled, internally-consistent reference scheme demonstrating real FM/DL structural mechanics (byte-per-glyph, pre-base reordering). **Not byte-verified against any specific commercial font** — see in-file disclaimer. |
| ල/ළ disambiguation | `utils/disambiguationEngine.js` | Hand-curated heuristic suggestion chip. Never silently overwrites output. |

### Part 2 — Typography Engineering
| Feature | File | Notes |
|---|---|---|
| Winding-rule fix | `utils/fontCompiler.js` → `normalizeWinding()` | Real bug fix — every stroke-outline contour now winds consistently clockwise, preventing unpredictable solid/hollow rendering. |
| Ligature-safe export | `utils/fontCompiler.js` → `resolveGlyphCodepoint()` | Fixes a real collision bug: multi-codepoint Atlas keys (e.g. "ක්ෂ") no longer clobber the base consonant's Unicode mapping — now routed to Private Use Area codepoints instead. Full GSUB/GPOS shaping was assessed as out-of-scope (see chat history) and intentionally not faked. |

### Part 3 — Workspace Merger
| Feature | File | Notes |
|---|---|---|
| Live Font Hot-Reload | `hooks/useLiveFontPreview.js` | Compiles current canvas glyphs to a base64 TTF, injects a live `@font-face`. Toggle in Text Studio. |
| Metrics → CSS binding | `App.jsx` (`suggestedLineHeight`) | "Sync" button in Text Studio's typography toolbar — pulls a derived line-height from your Canvas Metrics sliders. Manual override always still works. |
| Quick Reference routing | `App.jsx` (`jumpToCanvas`) | Click any Quick Reference card in Text Studio → jumps to Canvas Studio with that character selected. |

### Part 4 — Cognitive Innovation
| Feature | File | Notes |
|---|---|---|
| Style Profile Learning | `utils/styleProfileEngine.js` | Analyzes real stroke data from ක/ම/න/ර/ය to learn average width + contrast + curvature, then auto-applies matching brush defaults to undrawn glyphs. **Does not generate new letterforms** — that would require research-grade font-interpolation models, intentionally not faked. |

### Explicitly NOT built (with reasoning)
- **True OpenType GSUB/GPOS shaping compiler** — `opentype.js` has no high-level authoring API; building this safely requires AFDKO-style feature files, weeks of dedicated font-engineering work.
- **Variable Font (fvar/gvar) compiler** — `opentype.js` doesn't support VF table authoring at all.
- **Tesseract.js OCR-to-vector tracing** — Tesseract performs text recognition, not contour/shape tracing; using it for vector extraction would not work as described.

These three remain open future-roadmap items if you want to pursue them with appropriately scoped tooling.


---

## ♿ Performance & Accessibility Audit (v3.1)

Real audit, real fixes — every item below was confirmed present in the
codebase before fixing (grep counts, not assumptions), and re-validated
after (Node syntax check + functional round-trip tests where applicable).

### Performance
| Issue Found | Fix |
|---|---|
| `opentype.js` (~100-150KB) + `jspdf` (~280KB+) bundled into initial JS payload for every user, even those who never export | Converted to `await import()` dynamic imports inside `compileTTF`, `exportSpecimenPDF`, and `useLiveFontPreview` — now separate, lazily-fetched chunks |
| `AtlasMatrix` (90+ glyph buttons) re-rendered on every unrelated parent state change | Wrapped in `React.memo` |
| Vite worker output format unspecified | Explicit `worker: { format: 'es' }` added — required since `transliteration.worker.js` uses ES `import` |

### Accessibility — confirmed gaps (grep audit before fixing)
- **0** `aria-label` attributes anywhere in the codebase
- **8** instances of `focus:outline-none` with **zero** replacement focus style
- **78** instances of `opacity-30`/`opacity-40` on informational text (real contrast risk)
- **0** `prefers-reduced-motion` handling
- **0** modal focus-trapping (Help, Login, Delete-confirm dialogs were all "leaky" — keyboard users could Tab behind them)
- **14** icon-only buttons relying solely on `title` (unreliable for screen readers)

### Accessibility — fixes applied
- Global `:focus-visible` ring (themed, all 3 color modes) in `index.css`
- `@media (prefers-reduced-motion: reduce)` override + `motion-safe:` Tailwind variants on all `animate-pulse`/`animate-spin`
- `useFocusTrap` hook — Tab-cycle containment, Escape-to-close, focus-restore-on-close — applied to Help modal, Login modal, Delete-confirm modal, and all `BottomSheetDrawer` instances (each now `role="dialog"` `aria-modal="true"` `aria-labelledby`)
- `aria-label` added to every icon-only interactive element across all 11 components that have them; decorative icons marked `aria-hidden="true"`
- `aria-pressed`/`aria-checked`/`role="group"`/`role="radiogroup"` added to all toggle/segmented-control buttons (brush mode, theme switcher, zoom levels, encoding view, etc.)
- All previously placeholder-only inputs now have a properly associated `<label htmlFor>` via `useId()` (font name, search, Singlish/Sinhala/Legacy textareas, reference-char picker)
- Range sliders (Metrics Engine) get `aria-label` + `aria-valuetext`
- Custom toast (Admin) and transient status text (copy feedback, live-preview status) wrapped in `role="status"`/`aria-live="polite"`
- `SkipLink` component — keyboard users can bypass the header on every page load
- Contrast: bulk-upgraded `opacity-30→60` / `opacity-40→70` on all informational text (74 instances, 12 files) — then caught and fixed a real regression this introduced (12 buttons whose hover state had collapsed to match the resting state, since both used the same old opacity value) by restoring a proper hover delta

### Honest, documented limitation
The freehand drawing canvas itself is **not keyboard-operable** — this is an
inherent constraint shared by every visual vector-drawing tool (Glyphs,
FontForge, Illustrator included), not something fixable without abandoning
freehand input entirely. The canvas carries a descriptive `aria-label` so
screen-reader users at least know what they've encountered, and every
*surrounding* control (brush/eraser, undo/redo, metrics, zoom, mode toggles)
is fully keyboard-operable with documented shortcuts (`B E M S R X G [ ]
1-4 Ctrl+Z/Y`, visible via the in-app Shortcuts panel).

---

## 🔬 Deep Structural Audit + Version Auto-Sync (v3.2)

### Deep audit — 2 real bugs found and fixed
No JS bundler/linter was available in the build environment, so a custom
Python static-analysis engine was built (import/export graph, undefined-
reference detection, component prop-contract verification, React Hooks
rules, theme-token audit — 8 phases total) and run against all 43 source
files. This surfaced two genuine, non-obvious bugs:

| Bug | Root cause | Fix |
|---|---|---|
| Realtime collab could silently drop a user's own edit | `useRealtimeCollab.js` used a single shared boolean to suppress re-broadcasting an applied remote update — but a remote edit to character X could "poison" the flag and swallow the *next* local broadcast for a completely unrelated character | Replaced with a TTL-bounded, per-character `Map<char, timestamp>` — a skip-entry can only suppress the one immediate echo it was created for |
| Pinch-to-zoom could commit a stray stroke | `CanvasWorkspace.jsx`: if a user's first finger moved even slightly before a second finger touched down to pinch-zoom, the leftover single-finger draw state was never cleared, so `stopDrawing()` could commit that stray partial stroke on release | Second-finger touchdown now explicitly cancels any in-progress single-finger draw state |

Several bugs were also found and fixed *in the analyzer itself* along the
way (multi-declarator `const`, nested-paren default values, arrow functions
nested inside `.map()`/`Promise()`, JSX `=>` containing a literal `>`
character that broke naive tag matching) — documented transparently rather
than silently patched, since a "rock solid" audit should show its work.

### Version auto-sync — single source of truth
Previously, the version number ("v2.0.0 PRO") was **hardcoded separately in
5 different files** (Header, Footer, Help modal, Admin panel, console
branding, exported `.md` file footer) — and they had already drifted out of
sync with each other (some said "v2.0", others "v2.0.0") before this fix.

Now: **`package.json`'s `"version"` field is the only place version lives.**
Bumping it is the *only* manual step ever needed — every UI location
updates automatically, with zero risk of drift, ever again.

- `vite.config.js` reads `package.json` at build time and injects
  `__APP_VERSION__` via Vite's `define` config.
- It also injects `__BUILD_SHA__` (from Vercel's automatic
  `VERCEL_GIT_COMMIT_SHA` env var — no configuration needed, changes on
  *every single deploy* with no manual step at all) and `__BUILD_DATE__`.
- `src/utils/versionInfo.js` exposes these as `shortVersionLabel()`
  (Header/Help — "v3.2.0 PRO"), `fullVersionLine()` (Footer/Admin
  copyright), and `buildStamp()` (Admin diagnostics — "v3.2.0 · a1b2c3d ·
  2026-08-07", showing exactly which commit is live).
- Local dev (`npm run dev`, no Vercel env) safely falls back to
  `BUILD_SHA = 'dev'` via a `typeof` guard — verified to throw no error
  even when `define` hasn't run.

**To release a new version:** edit one line in `package.json`, commit, push.
That's it — nothing else to remember, nowhere else to hunt.

---

## 🐛 v3.3 — Modal Overflow Fix + Legal/Contact Modal

### Real bug fixed: Help modal was unreachable on short viewports
The onboarding Help modal (10 feature items) had no height constraint or
internal scrolling. On any viewport shorter than the content, the modal
overflowed off-screen with the "Continue" button pushed below the visible
area — unreachable by touch or click. The only way out was the keyboard
(`Escape`/`Enter`), because `useFocusTrap` auto-focuses the first focusable
element on open, which happened to *be* that same off-screen button — so
keyboard `Enter` worked by coincidence while the visible UI offered no way
out at all.

**Fix:** rebuilt with a proper fixed-header / scrollable-body / fixed-footer
layout (`max-h-[90vh] flex flex-col`, body `flex-1 overflow-y-auto`) — the
same pattern already used correctly in `BottomSheetDrawer`. The action
button is now *always* visible and reachable regardless of content length
or viewport height. The same `max-h-[90vh] overflow-y-auto` safety net was
added defensively to the Login modal, the Confirm/Prompt modal, and the
Admin delete-confirmation modal — their content is short today, but the
class of bug (unbounded modal height) is now closed everywhere, not just
patched where it happened to be reported.

### New: Legal Notice & Contact modal
The footer copyright line was barely visible (`opacity-50`) and purely
decorative. Now:
- **High-contrast, bold, clickable** — uses the theme's accent color,
  `font-black` weight, underlines on hover, with a chevron affordance.
- **Opens a full modal** (`src/components/Shared/LegalModal.jsx`) with the
  complete copyright/legal notice (auto-synced to the live version via
  `versionInfo.js`, same single-source-of-truth system as the rest of the
  app) and a **WhatsApp contact link** (`wa.me/94770020223`) that opens a
  real chat, not just displayed text.
- Reachable from *two* spots in the footer — the copyright line and the
  "Unauthorized duplication prohibited" text — since both are part of the
  same legal-notice cluster.

**A subtle CSS bug caught and fixed along the way:** the initial version
put `opacity-70` on the *parent* wrapper of the clickable Shield button and
`hover:opacity-100` on the button itself, intending the button to brighten
on hover. CSS opacity compounds down the render tree and cannot be
"brightened back up" by a descendant's own opacity value — so that hover
effect was silently a no-op. Fixed by scoping opacity to each element
individually instead of a shared dimmed ancestor.

