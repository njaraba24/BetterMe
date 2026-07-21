
-- Habits: category, color, archived
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#9B9A97',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Journal: tags + mood
ALTER TABLE public.journal_pages
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mood text;

-- Allow accepted friends to SELECT each other's habits and habit_logs
DROP POLICY IF EXISTS "Friends can view habits" ON public.habits;
CREATE POLICY "Friends can view habits"
ON public.habits FOR SELECT
TO authenticated
USING (public.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "Friends can view habit logs" ON public.habit_logs;
CREATE POLICY "Friends can view habit logs"
ON public.habit_logs FOR SELECT
TO authenticated
USING (public.are_friends(auth.uid(), user_id));
