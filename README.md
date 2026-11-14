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



---

## v3.4 – v3.6.1 — Security, Layout, Prediction, Diagnostics

- **Security (v3.4 / v3.6.1):** `glyph_history` RLS was fully open (`USING (true)`). Now least-privilege:
  read = own / guest / public project; insert = own / guest only; no client UPDATE/DELETE.
  **Run the policy block in `fontcraft-db-schema.sql` in the Supabase SQL Editor — it does not apply on deploy.**
- **Desktop layout (v3.5):** Header and Footer stay fixed on desktop (`md:` and up); only the middle area scrolls. Mobile unchanged.
- **Stroke Prediction (v3.6):** toggle `Predict` or press `P`. Draws a faint dashed ghost line extending the pen's
  current direction (simple trajectory extrapolation on a separate overlay canvas; it never alters stroke data).
  It does NOT predict whole letter shapes.
- **Diagnostics (v3.6):** Admin -> Diagnostics runs live checks in the browser (storage, canvas, service worker,
  Supabase round-trip, workers) and shows the exact build version / SHA / feature flags actually running.
- **Footer (v3.6.1):** copyright line regular weight, author name bold.

---

## v3.7.0 – Responsive refinement
- Three-column layout now starts at **1024px (lg)**; tablets (768–1023px) use the full-width canvas + Atlas/Metrics bottom sheets instead of cramped 170px side columns.
- Viewport no longer blocks pinch-zoom (accessibility); `viewport-fit=cover` + safe-area insets for notch / home indicator.
- Fixed desktop shell uses `100dvh` (no jump from mobile browser toolbars).
- Inputs are 16px on small screens (no iOS auto-zoom); larger touch targets and slider thumbs on touch devices; glyph hover-scale only on hover devices.
- Toast stack fits 320px screens; canvas centred in its panel.

## v3.7.1
- Modals/sheets use dynamic viewport height; 9px labels bump to 10px on phones; footer padding/alignment tuned for small screens; reduced-motion respected for sheet animations; landscape-phone sheet height.

## v3.8.0 – Deep logic audit
Fixed (all verified by running the real code in Node; tests live in `tests/logic.test.mjs`, run automatically by GitHub Actions on every push):
- Transliteration: `oo` now gives ෝ (was ො); `ng` no longer produces a broken `ං්` (nga before a vowel, anusvara otherwise); capital letters mid-sentence (e.g. "Pasal") no longer corrupt the whole word; `c`→ච, `T`→ඨ added.
- Legacy converter: `ං` and stacked marks (ිං, ාං) are now actually encoded/decoded.
- Trie: suggestions are now truly ranked by frequency (a pruning cut-off used to drop top words).
- Font compiler: per-glyph advance width + side bearings from the real drawn shape (was one fixed width, causing overlap), a space glyph, and dots/taps (ං, ඃ, full stop) are exported instead of dropped.
- Canvas: a single tap now draws a dot instead of being discarded.
- Text Studio: accepting a suggestion / editing the output no longer makes earlier text vanish on the next keystroke.
- Storage: blocked/full localStorage can no longer crash the app on load.
- Downloads: blob URLs revoked after a delay (Safari-safe).
Known design limits (not code bugs): guests share the `guest` cloud row namespace, so two guests using the same font name share one row; fix needs a SQL migration (composite unique key).

---

## v4.0.0 – KRTD Agent (in-app assistant)
Open with the 🤖 button (bottom-right) or **Alt+A**.
- **Guide** – project health score (0-100), coverage per section, *predicted path* (what to draw next and why), issues with one-tap fixes.
- **Autopilot** – step-by-step workflow (metrics → anchors → style → consonants → vowels → extended → quality → export) with "Run next step", "Fix everything automatically" and optional auto-advance to the next predicted glyph after you finish one.
- **Chat** – commands in Sinhala / Singlish / English (`ක`, `ඊළඟ අකුර?`, `fix all`, `save`, `export ttf`, `text studio`). Works 100% offline (local brain).
- **Cloud AI (optional)** – free-form questions go to Gemini / Z.AI GLM / Claude through the Vercel function `api/agent.js`. Set any key in Vercel env vars (`GEMINI_API_KEY`, `ZAI_API_KEY`, `ANTHROPIC_API_KEY`; see `.env.example`). Needs a logged-in Designer (cost protection + rate limit). Without a key the Agent silently stays local.
- **Safety** – the Agent can only run a whitelist of actions (`src/agent/actionSchema.js`), risky ones ask for confirmation, it never overwrites a drawn glyph and never draws for you. Fixes that change strokes are Undo-able.
- Honest limits: path prediction and scoring are transparent heuristics (documented in `src/agent/knowledge.js`), not a trained model; the Agent does not generate letter shapes.
- Rollback: set `ENABLE_AGENT: false` in `src/utils/featureFlags.js`.
- CI: `.github/workflows` now runs the logic tests **and a full `npm run build`** on every push (see GitHub → Actions).

## v4.1.0 – Multi-provider AI (Gemini · Z.AI · Claude)
- `api/_providers.js`: Gemini (`generateContent`), Z.AI GLM (OpenAI-compatible `/chat/completions`) and Claude behind one interface. `AI_PROVIDER=auto` tries Gemini -> Claude -> Z.AI; if one fails/blocks, the next configured provider answers; if all fail the local agent answers.
- Sinhala/Unicode: strict Sinhala-Unicode instructions in the system prompt, JSON-mode output, NFC normalization and control/replacement-character stripping on every reply.
- The Agent header shows which AI is on (`LOCAL + GEMINI`) via a free `__ping__` call; each AI answer carries a provider badge.
- Model names change often — override with `GEMINI_MODEL` / `ZAI_MODEL` / `ANTHROPIC_MODEL` without touching code.

## v4.1.1 – AI provider hidden from end users
- Users only see a generic "AI" / "SMART" badge. Provider names, models and key hints are shown ONLY in Admin -> Diagnostics ("Agent cloud AI backend") and only to admin / super_admin accounts (verified server-side). The API never returns the provider name in answers.

## v4.2.0 — Export now matches the canvas
- TTF/OTF export uses new `src/utils/strokeOutline.js`: same quadratic smoothing as the canvas, round caps and joints, tap → dot. Glyphs are no longer angular/flat-ended.
- Contours unioned with nonzero winding (`normalizeWinding`), so tight curves don't leave holes.
- Tests added (28 groups). Trade-off: slightly more contour points per glyph → slightly larger font file.

## v4.3.0 — Shape Guide (hollow standard shape)
- Canvas toolbar **Shape** button (or key **H**): shows a hollow, outline-only standard shape of the selected letter under the drawing canvas.
- Adjust per letter: size, left/right, up/down, rotate, line weight, opacity, dashed; Auto-fit / Reset.
- Tracing aid only: drawn on a separate overlay canvas — never saved to glyph data, history, cloud, PNG or TTF export.
- Uses the loaded Noto Sans Sinhala (or the device's Sinhala font); a notice appears if none is available.
- Agent: new `shape_guide` action + button in the Guide tab ("Shape Guide පෙන්වන්න").

## v4.4.0 — Shape Guide upgrade
- **Styles**: Sans, Serif, Classic (Abhaya Libre), Soft (Yaldevi), Modern (Gemunu Libre) — separate font links in index.html so a failed font never breaks the app.
- **1·2·3 order**: numbered start points per piece (body first, then marks left→right). Automatic estimate from the glyph shape, not hand-authored stroke data.
- **Metrics snap**: one shared scale (anchor ක fills x-height→baseline) and baseline alignment for every letter.
- **Match my style**: sizes/shifts the guide from the anchors (ක ම න ර ය) you already drew.
- **Accuracy meter**: F1 of drawn ink vs guide shape (tolerance ~16px). Aid only, not a grade.
- **Compare view**: standard · yours · overlay.
- **Remembered on this device** (localStorage `krtd_shape_guide_v1`); never saved to glyphs/cloud/exports.
- Tests: 32 groups; DOM drawing/scoring code also executed in headless Chromium (no Sinhala font there, so shapes themselves were not eyeballed).

## v4.4.1 — Desktop scroll fix + compact Shape panel
- **Fix**: on desktop (≥1024px) the page below the header could not scroll (canvas hidden under the Shape panel). Root cause: the layout used `lg:app-shell`, but `.app-shell` is plain CSS, so Tailwind never generated that `lg:` variant. Now `.app-root` / `.app-scroll` are plain CSS in index.css: the header stays, the work area is the one scroll container; below 1024px the page scrolls normally. Verified in headless Chromium at 1866×990, 1280×720 and 800×900.
- Shape panel is compact by default: styles, toggles and a one-line accuracy bar; sliders / Match / Reset are under “Adjust”.
- Font check: if the chosen guide style's web font did not load, the panel says so (falls back to another font).
- Fonts confirmed with Sinhala support: Noto Sans/Serif Sinhala, Abhaya Libre, Yaldevi, Gemunu Libre.
- Combining signs (ං ා ි …) no longer get numbered pieces.

## v4.4.2
- Shape Guide: **Front layer** option (keeps the guide visible over the strokes, e.g. after using the eraser).
- Shortcut list + in-app Help now mention Shape Guide (H).
- `vite.config.js`: `esbuild.drop` moved to the valid top-level option.

## v4.5.0 — Per-owner cloud projects (guest collision fix) + safer RLS
**Problem**: `font_name` was UNIQUE across the whole table and every guest shared owner id `'guest'`, so users/guests with the same font name overwrote each other; admins could not see other users' projects; `user_roles` policies recursed into themselves (`infinite recursion detected in policy`).

**Now**
- Projects are keyed by **(owner, font name)**. Signed-in owner = auth UUID; guest owner = `g:<random uuid>` created once per device (`src/utils/ownerId.js`).
- Pull falls back to the old shared `guest` copy (read-only) so nothing is lost; the next Push saves a copy under the new owner id.
- Upsert falls back to the old key if the SQL has not been run yet (error 42P10), so the app never breaks mid-migration.
- Admin dashboard can read all projects (admin) and delete/flag (super admin only).

**Database (existing project)** — run `supabase/migration-v4.5-owner-keys.sql` in two steps: STEP 1 now, deploy, STEP 2 after. A fresh database just runs `fontcraft-db-schema.sql` (already updated). Both were executed and checked on a real PostgreSQL 16 with Supabase-style roles/`auth.uid()`: same-name guests/users coexist, nobody can write/delete another owner's row, legacy `guest` rows are read-only, admin vs super-admin rights, history inserts follow the owner, re-runs are idempotent.
- Known limit: guest device ids are not secret (anyone holding the public anon key can still read guest rows, as before). Real privacy for guests needs Supabase anonymous sign-ins.

## v4.6.0 — Real TrueType export (+ OTF), curated font tables
**Found by actually inspecting the output with fontTools / FreeType / Chromium:**
- The "TTF" was really a **CFF OpenType (OTTO)** font with a `.ttf` name. Now `.ttf` is a genuine **TrueType (`glyf`)** font built by our own writer (`src/utils/ttfWriter.js`, no dependencies); `.otf` (CFF via opentype.js, lazy-loaded) is a separate export.
- Gentle curves left hair-thin **wedge gaps** between neighbouring segment quads (156 uncovered edge samples on a test ring) — now filled (0 gaps; regression test).
- Font metadata was poor (weight 500, junk unique ID `" :Name"`, empty names, OS/2 v3, no Unicode ranges, no gasp). Now: OS/2 v4 (weight 400, Sinhala/Latin/PUA ranges, typo + win metrics from real bounds so nothing is clipped, USE_TYPO_METRICS), proper name table (Windows + Mac), PostScript name, `gasp`, `post` 3.0, correct hhea/maxp/head.
- `.notdef` is now a visible box; duplicate / non-BMP codepoints are skipped safely.
- Live preview (Text Studio) uses the same TrueType build.

**Verified**: both fonts load with fontTools; render identically in Chromium (its OTS web-font sanitizer accepted both); TrueType contours are all clockwise; structure/checksum/cmap/glyf round-trip are unit-tested (36 test groups).
- Known limits: no GSUB (ligature glyphs live on Private-Use codepoints), no hinting (gasp requests smooth grey scaling), outlines are many overlapping convex pieces (correct under the non-zero rule, a little larger than a merged outline).

## v4.7.0 — Brush presets palette

- New collapsible **BRUSH PRESETS** panel above the brush controls (Canvas Studio).
- 10 built-in presets in 3 groups (Pen nibs / Brushes / Monoline). A preset = brush mode + stroke width, so it works with the existing brush engine unchanged.
- Each swatch shows a live preview of the stroke shape; the active preset is highlighted automatically when mode + size match.
- **MY BRUSHES**: save the current brush (max 8), remove with ✕. Stored in `localStorage` (`krtd_brush_palette_v1`), validated on load.
- Logic lives in `src/utils/brushPresets.js` (pure, covered by tests); UI in `BrushPalette.jsx`.

## v4.8.0 — OpenType ligatures (GSUB) in exported fonts

- Ligature glyphs (ක්ෂ, ශ්‍රී …) now work when you simply **type** the Unicode sequence in apps that use OpenType shaping (Word, Canva, browsers, Figma …). Before, they were reachable only through a Private-Use codepoint.
- `src/utils/gsubWriter.js` writes a `GSUB` table (LigatureSubst, features `ccmp` + `liga`, scripts `DFLT` + `sinh`) and works for both TTF and OTF. Sequences are registered with and without ZWJ after the virama.
- A ligature is only emitted if every component character is also drawn in the font (e.g. ක, ්, ෂ for ක්ෂ). A zero-width ZWJ glyph is added automatically.
- Verified with fontTools (GSUB parse) and Chromium/HarfBuzz shaping (typed sequence renders the same width as the ligature glyph; without GSUB it does not). Pili positioning / GPOS mark placement are still not implemented.

## v4.9.0 — WOFF web-font export

- New **Export WOFF (web font)** button (Metrics panel). Packs the same real TrueType font (incl. GSUB ligatures) into WOFF 1.0 with per-table zlib compression (`src/utils/woffWriter.js`, uses the browser's built-in `CompressionStream`, no extra dependency).
- Typically ~4× smaller than the TTF; use it in `@font-face` on websites.
- Verified: lossless round-trip test of every table, and fontTools opens the result.

## v5.0.0 — GPOS kerning + combining-mark positioning (GDEF)

- `src/utils/gposWriter.js` adds **GPOS** and **GDEF** tables to every export (TTF, OTF, WOFF).
- **Pair kerning (`kern`)**: computed automatically from the drawn outlines (ink profile per 25-unit band, gap vs the font's median gap). Over-wide pairs are tightened (max −150), colliding pairs loosened (max +60); tiny values ignored; max 4000 pairs.
- **Mark-to-base (`mark`, `abvm`, `blwm`)** for the Sinhala combining signs that sit above/below a letter: ් (0DCA), ි (0DD2), ී (0DD3), ු (0DD4), ූ (0DD6), ඁ (0D81). Each mark gets zero advance and is centred on its base letter; it keeps the height you drew it at unless a tall base would collide (then it is lifted/lowered with a 20-unit gap).
- GDEF classifies letters as bases and these signs as marks so shapers treat them correctly.
- Not covered: spacing vowel signs placed beside the letter (ා, ෙ, ො …) and pre-base reordering still depend on the shaper plus your own drawing/advance; mark-to-mark stacking is not implemented.
- Verified with fontTools (table parse) and Chromium/HarfBuzz (rendered ි / ු merge onto the base letter instead of trailing it).

## v5.1.0 — Spacing vowel signs + Coverage report

- **Spacing vowel signs** (ා ැ ෑ ෘ ෟ ං ඃ after the letter; ෙ ේ ෛ before it): they now get a tight bearing on the side that touches the letter (15 units) and a normal one on the other side, with a minimum advance of 110. They are excluded from optical kerning so the tight fit is never undone. Verified in Chromium: "කා" trails the letter closely, "කෙ" reorders ෙ in front of ක with the same tight gap. ො / ෝ are built by the shaper from ෙ + ා (+ ්) when you have not drawn them as whole glyphs.
- **Coverage card** (Metrics panel): drawn / total, progress bar, readiness level (starting / partial / usable / complete), per-section counts and an "ඊළඟට අඳින්න" list of the 8 most everyday missing letters — click one to jump to it. Logic in `src/utils/coverage.js` (tested).

## v5.2.0 — Export check

- **EXPORT CHECK** card (Metrics panel → "Run check"): runs the same font build the exporter uses and lists problems in plain Sinhala: nothing drawn, glyphs that would be skipped, ligatures that can never auto-form because a component letter is missing (e.g. ක්ෂ without ් or ෂ), glyphs far outside the ascender/descender lines, dot-sized glyphs, very complex or very wide glyphs, missing core letters and missing common pili. Each listed letter is clickable to jump to it. Logic: `src/utils/fontQuality.js` (loaded on demand, tested).
- Text Studio already renders with the compiled font, so typed Sinhala there goes through the same GSUB/GPOS shaping as the exported file.

## v5.3.0 — Font info editor

- **FONT INFO** card (Metrics panel): designer, copyright, license, website, description, version (`1.000` format) and embedding permission (Installable / Editable / Preview & print). Saved in the browser (`krtd_font_meta_v1`) and written into every export: name table (ids 0, 5, 9, 10, 11, 13) and OS/2 `fsType` for TTF/WOFF; the OTF export gets the text fields (its fsType stays 0).
- Inputs are sanitised (`<>`/control characters stripped, URL must be http(s), version normalised) in `src/utils/fontMeta.js` (tested).

## v5.4.0 — Typing test sheet + per-glyph spacing

- **Typing Test Sheet (PNG)** button (Metrics panel): compiles the font, loads it with `FontFace`, and draws 6 real Sinhala sample lines at 72 / 44 / 28 px using normal browser text shaping — so ligatures (GSUB), kerning and mark positioning (GPOS) are exactly what a user will see. Each line is labelled "All letters drawn" or "Missing: …" (combining signs shown on a ◌). Tested end-to-end in headless Chromium.
- **SPACING card** (Metrics panel): extra left / right bearing (−50 … +150 units) for the selected letter. Applied in the compiled font (export + Text Studio preview). Stored in this browser (`krtd_glyph_spacing_v1`); not part of the cloud/JSON project yet. The Text Studio live preview picks the change up the next time the glyphs or metrics change.
