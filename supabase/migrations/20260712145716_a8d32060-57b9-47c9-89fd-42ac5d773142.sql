
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;

-- Compute XP for a given user from their own data.
CREATE OR REPLACE FUNCTION public.get_user_xp(_user_id uuid)
RETURNS TABLE(xp integer, habit_days integer, tasks_done integer, goals_done integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (COALESCE((SELECT count(*) FROM public.habit_logs WHERE user_id = _user_id AND done), 0) * 10
     + COALESCE((SELECT count(*) FROM public.tasks WHERE user_id = _user_id AND done), 0) * 5
     + COALESCE((SELECT count(*) FROM public.goals WHERE user_id = _user_id AND done), 0) * 50)::int AS xp,
    COALESCE((SELECT count(*)::int FROM public.habit_logs WHERE user_id = _user_id AND done), 0) AS habit_days,
    COALESCE((SELECT count(*)::int FROM public.tasks WHERE user_id = _user_id AND done), 0) AS tasks_done,
    COALESCE((SELECT count(*)::int FROM public.goals WHERE user_id = _user_id AND done), 0) AS goals_done;
$$;

-- Leaderboard among accepted friends + self who opted in.
CREATE OR REPLACE FUNCTION public.get_friends_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, xp integer, opted_in boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  friend_ids AS (
    SELECT CASE WHEN requester_id = (SELECT id FROM me) THEN addressee_id ELSE requester_id END AS uid
    FROM public.friendships
    WHERE status = 'accepted'
      AND ((SELECT id FROM me) IN (requester_id, addressee_id))
  ),
  everyone AS (
    SELECT (SELECT id FROM me) AS uid
    UNION
    SELECT uid FROM friend_ids
  )
  SELECT p.id, p.display_name,
         (public.get_user_xp(p.id)).xp,
         p.leaderboard_opt_in
  FROM everyone e
  JOIN public.profiles p ON p.id = e.uid
  WHERE p.leaderboard_opt_in = true OR p.id = (SELECT id FROM me);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_xp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard() TO authenticated;
