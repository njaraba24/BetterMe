
-- Tighten profiles SELECT policy: self + accepted friends only
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by self or friends"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.are_friends(auth.uid(), id)
);

-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant only to authenticated where the app needs it
REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_friends_leaderboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_xp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_xp(uuid) TO authenticated;

-- Trigger-only functions: no direct execute needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
