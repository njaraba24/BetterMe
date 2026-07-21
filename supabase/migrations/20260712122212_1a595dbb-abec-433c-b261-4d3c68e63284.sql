
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.profiles (id, email, display_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Lookup helper
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;

-- FRIENDSHIPS
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "respond to friend requests" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "delete own friendships" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Are two users accepted friends?
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- JOURNAL SHARES
CREATE TABLE public.journal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.journal_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, shared_with_id)
);
GRANT SELECT, INSERT, DELETE ON public.journal_shares TO authenticated;
GRANT ALL ON public.journal_shares TO service_role;
ALTER TABLE public.journal_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see shares involving me" ON public.journal_shares FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);
CREATE POLICY "owners create shares with friends" ON public.journal_shares FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.are_friends(owner_id, shared_with_id));
CREATE POLICY "owners or recipients remove share" ON public.journal_shares FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

-- Let recipients read shared journal pages
CREATE POLICY "read shared journal pages" ON public.journal_pages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.journal_shares s
    WHERE s.page_id = journal_pages.id AND s.shared_with_id = auth.uid()
  ));
