import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/week")({
  component: WeekView,
});

type Habit = { id: string; name: string; color: string; archived_at: string | null };
type Task = { id: string; title: string; done: boolean; due_date: string | null };

const PROMPTS = [
  "What went well today?",
  "One thing I'm grateful for…",
  "A small win from this week.",
  "What did I learn recently?",
  "What's weighing on my mind?",
  "How am I taking care of myself today?",
  "Who do I want to reach out to?",
];

function WeekView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits")
        .select("id,name,color,archived_at,user_id")
        .eq("user_id", user!.id)
        .is("archived_at", null);
      if (error) throw error;
      return (data as Habit[]) ?? [];
    },
    enabled: !!user,
  });

  const { data: todayLogs = [] } = useQuery<{ habit_id: string; done: boolean }[]>({
    queryKey: ["logs-today", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs")
        .select("habit_id,done").eq("date", dateStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return (data as Task[]) ?? [];
    },
  });

  const dueTasks = tasks.filter((t) => !t.done && t.due_date && t.due_date <= dateStr);

  const toggleLog = useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      const { error } = await supabase.from("habit_logs")
        .upsert({ user_id: user!.id, habit_id: habitId, date: dateStr, done }, { onConflict: "habit_id,date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs-today", dateStr] }),
    onError: (e) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const doneMap = new Map(todayLogs.map((l) => [l.habit_id, l.done]));
  const prompt = PROMPTS[today.getDate() % PROMPTS.length];

  return (
    <div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">This week</h1>
        <p className="mt-1 text-sm text-muted-foreground">{format(today, "EEEE, MMMM d")}</p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Today's habits</h2>
          {habits.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No habits — <Link to="/habits" className="text-primary underline">add one</Link>.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {habits.map((h) => {
                const done = doneMap.get(h.id) ?? false;
                return (
                  <li key={h.id} className="flex items-center gap-3">
                    <Checkbox checked={done} onCheckedChange={(v) => toggleLog.mutate({ habitId: h.id, done: !!v })} />
                    <span className="h-2 w-2 rounded-full" style={{ background: h.color }} />
                    <span className={done ? "text-muted-foreground line-through" : ""}>{h.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Due today or overdue</h2>
          {dueTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing due. </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dueTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <Checkbox checked={t.done} onCheckedChange={(v) => toggleTask.mutate({ id: t.id, done: !!v })} />
                  <span className="flex-1">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.due_date && format(new Date(t.due_date), "MMM d")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border p-5 md:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground">Journal prompt</h2>
          <p className="mt-3 text-lg">{prompt}</p>
          <Link to="/journal" className="mt-3 inline-block text-sm text-primary underline">
            Open journal →
          </Link>
        </section>
      </div>
    </div>
  );
}
