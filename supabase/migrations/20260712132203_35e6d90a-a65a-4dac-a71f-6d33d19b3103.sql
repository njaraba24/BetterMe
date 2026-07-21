
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Friends can view habits" ON public.habits;
CREATE POLICY "Friends can view shared habits" ON public.habits
  FOR SELECT USING (shared = true AND public.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "Friends can view habit logs" ON public.habit_logs;
CREATE POLICY "Friends can view shared habit logs" ON public.habit_logs
  FOR SELECT USING (
    public.are_friends(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_logs.habit_id AND h.shared = true)
  );
