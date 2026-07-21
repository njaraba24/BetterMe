
CREATE TABLE public.journal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.journal_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_comments_page ON public.journal_comments(page_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_comments TO authenticated;
GRANT ALL ON public.journal_comments TO service_role;

ALTER TABLE public.journal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on accessible pages"
ON public.journal_comments FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.journal_pages p WHERE p.id = page_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.journal_shares s WHERE s.page_id = journal_comments.page_id AND s.shared_with_id = auth.uid())
);

CREATE POLICY "Insert comments on accessible pages"
ON public.journal_comments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.journal_pages p WHERE p.id = page_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.journal_shares s WHERE s.page_id = journal_comments.page_id AND s.shared_with_id = auth.uid())
  )
);

CREATE POLICY "Authors update own comments"
ON public.journal_comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authors or page owner delete"
ON public.journal_comments FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.journal_pages p WHERE p.id = page_id AND p.user_id = auth.uid())
);

CREATE TRIGGER journal_comments_touch_updated_at
BEFORE UPDATE ON public.journal_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
