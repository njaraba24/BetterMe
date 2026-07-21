import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Repeat, CheckSquare, Wallet, Target, Sparkles } from "lucide-react";
import { computeLevel, computeBadges } from "@/lib/gamification";
import { computeStreaks, type HabitLog } from "@/lib/habit-utils";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["dashboard", today, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [habits, logs, tasks, finance, goals, xpRes, allLogs, doneTasks, doneGoals] = await Promise.all([
        supabase.from("habits").select("id"),
        supabase.from("habit_logs").select("habit_id,done").eq("date", today),
        supabase.from("tasks").select("id").eq("due_date", today).eq("done", false),
        supabase.from("finance_entries").select("type,amount").gte("date", monthStart).lte("date", monthEnd),
        supabase.from("goals").select("id").eq("done", false),
        supabase.rpc("get_user_xp", { _user_id: user!.id }),
        supabase.from("habit_logs").select("habit_id,date,done").eq("done", true),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", true),
        supabase.from("goals").select("id", { count: "exact", head: true }).eq("done", true),
      ]);
      const totalHabits = habits.data?.length ?? 0;
      const doneHabits = logs.data?.filter((l) => l.done).length ?? 0;
      let income = 0, expense = 0;
      finance.data?.forEach((e) => {
        const a = Number(e.amount);
        if (e.type === "income") income += a; else expense += a;
      });
      const logsArr = (allLogs.data as HabitLog[]) ?? [];
      const habitIds = Array.from(new Set(logsArr.map((l) => l.habit_id)));
      const longestStreak = habitIds.reduce((m, id) => Math.max(m, computeStreaks(id, logsArr).longest), 0);
      const xpRow = Array.isArray(xpRes.data) ? xpRes.data[0] : xpRes.data;
      return {
        habits: `${doneHabits}/${totalHabits}`,
        tasks: tasks.data?.length ?? 0,
        income, expense,
        goals: goals.data?.length ?? 0,
        xp: (xpRow as { xp?: number } | undefined)?.xp ?? 0,
        habit_days: logsArr.length,
        tasks_done: doneTasks.count ?? 0,
        goals_done: doneGoals.count ?? 0,
        longestStreak,
      };
    },
  });

  const greeting = (() => {
    const h = new Date().getHours();
    const base = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const name = profile?.display_name || user?.email?.split("@")[0] || "";
    return name ? `${base}, ${name}` : base;
  })();

  const cards = [
    { to: "/habits", label: "Habits today", value: data?.habits ?? "—", icon: Repeat },
    { to: "/tasks", label: "Tasks due today", value: data?.tasks ?? "—", icon: CheckSquare },
    { to: "/finance", label: "This month", value: data ? `+${data.income.toFixed(0)} / -${data.expense.toFixed(0)}` : "—", icon: Wallet },
    { to: "/goals", label: "Active goals", value: data?.goals ?? "—", icon: Target },
  ] as const;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-lg border bg-card p-5 transition-colors hover:bg-muted">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </Link>
        ))}
      </div>

      {data && (() => {
        const { level, nextAt, intoLevel } = computeLevel(data.xp);
        const prev = nextAt - (nextAt - (nextAt - intoLevel - (nextAt - intoLevel - intoLevel)));
        const span = nextAt - (data.xp - intoLevel);
        const pct = Math.min(100, Math.round((intoLevel / (span || 1)) * 100));
        const badges = computeBadges({
          habit_days: data.habit_days,
          tasks_done: data.tasks_done,
          goals_done: data.goals_done,
          longestStreak: data.longestStreak,
        });
        const earned = badges.filter((b) => b.earned);
        return (
          <div className="mt-8 rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Level {level}</span>
                <span className="text-xs text-muted-foreground">{data.xp} XP</span>
              </div>
              <span className="text-xs text-muted-foreground">Next: {nextAt} XP</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span
                  key={b.id}
                  title={`${b.label} — ${b.description}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${b.earned ? "" : "opacity-30 grayscale"}`}
                >
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{earned.length}/{badges.length} badges earned</p>
          </div>
        );
      })()}
    </div>
  );
}
