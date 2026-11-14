-- v5.6: per-glyph spacing + font info are saved with the cloud project.
-- Safe to run more than once. The app also works without it (it falls back to saving without `settings`).
ALTER TABLE public.font_projects
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
