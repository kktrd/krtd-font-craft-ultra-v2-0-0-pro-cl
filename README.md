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
