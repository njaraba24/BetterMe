import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Flame, Trophy, Users, Medal } from "lucide-react";
import { computeStreaks, type HabitLog } from "@/lib/habit-utils";
import { computeLevel } from "@/lib/gamification";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/accountability")({
  component: AccountabilityPage,
});

type Friendship = { requester_id: string; addressee_id: string; status: string };
type Profile = { id: string; display_name: string; email: string };
type Habit = { id: string; user_id: string; name: string; color: string; archived_at: string | null };

function AccountabilityPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,leaderboard_opt_in").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: leaderboard = [] } = useQuery<Array<{ user_id: string; display_name: string; xp: number; opted_in: boolean }>>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_friends_leaderboard");
      if (error) throw error;
      return (data as Array<{ user_id: string; display_name: string; xp: number; opted_in: boolean }>) ?? [];
    },
  });

  const toggleOptIn = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await supabase.from("profiles").update({ leaderboard_opt_in: v }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const { data: friendships = [] } = useQuery<Friendship[]>({
    queryKey: ["friendships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("friendships").select("requester_id,addressee_id,status").eq("status", "accepted");
      if (error) throw error;
      return (data as Friendship[]) ?? [];
    },
  });

  const friendIds = friendships.map((f) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id));

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["accountability-profiles", friendIds],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,email").in("id", friendIds);
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });

  const { data: friendHabits = [] } = useQuery<Habit[]>({
    queryKey: ["friend-habits", friendIds],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("habits")
        .select("id,user_id,name,color,archived_at").in("user_id", friendIds).is("archived_at", null);
      if (error) throw error;
      return (data as Habit[]) ?? [];
    },
  });

  const habitIds = friendHabits.map((h) => h.id);
  const { data: friendLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ["friend-logs", habitIds],
    enabled: habitIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs")
        .select("habit_id,date,done").in("habit_id", habitIds).eq("done", true);
      if (error) throw error;
      return (data as HabitLog[]) ?? [];
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-3xl font-semibold tracking-tight">Accountability</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        See your friends' habit streaks. Journal, tasks, goals and finance stay private.
      </p>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium">Leaderboard</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Show me on leaderboard
            <Switch
              checked={!!myProfile?.leaderboard_opt_in}
              onCheckedChange={(v) => toggleOptIn.mutate(v)}
            />
          </label>
        </div>
        {leaderboard.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No entries yet. Opt in to see yourself, and ask friends to opt in too.</p>
        ) : (
          <ol className="mt-3 space-y-1">
            {[...leaderboard].sort((a, b) => b.xp - a.xp).map((row, i) => {
              const { level } = computeLevel(row.xp);
              const isMe = row.user_id === user?.id;
              return (
                <li key={row.user_id} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${isMe ? "bg-muted" : ""}`}>
                  <span className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                    <span>{row.display_name}{isMe ? " (you)" : ""}</span>
                    <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">Lv {level}</span>
                  </span>
                  <span className="text-xs font-medium">{row.xp} XP</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>


      {friendIds.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No friends yet. Add one from the Friends page to see their streaks here.
        </p>
      )}

      <div className="mt-8 space-y-8">
        {friendIds.map((fid) => {
          const p = profiles.find((x) => x.id === fid);
          const theirHabits = friendHabits.filter((h) => h.user_id === fid);
          return (
            <section key={fid}>
              <h2 className="text-sm font-medium">{p?.display_name || p?.email || "Friend"}</h2>
              {theirHabits.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No active habits.</p>
              ) : (
                <ul className="mt-2 divide-y rounded-lg border">
                  {theirHabits.map((h) => {
                    const { current, longest } = computeStreaks(h.id, friendLogs);
                    return (
                      <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: h.color }} />
                          {h.name}
                        </span>
                        <span className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1" title="Current streak">
                            <Flame className="h-3.5 w-3.5 text-orange-500" /> {current}d
                          </span>
                          <span className="inline-flex items-center gap-1" title="Longest streak">
                            <Trophy className="h-3.5 w-3.5 text-amber-500" /> {longest}d
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
