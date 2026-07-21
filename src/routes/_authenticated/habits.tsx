import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Archive, ArchiveRestore, Flame, Plus, Share2, Trash2, Trophy } from "lucide-react";
import { format, startOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { toast } from "sonner";
import { HABIT_CATEGORIES, categoryMeta, computeStreaks, type HabitLog } from "@/lib/habit-utils";

export const Route = createFileRoute("/_authenticated/habits")({
  component: HabitsPage,
});

type Habit = {
  id: string;
  name: string;
  category: string;
  color: string;
  archived_at: string | null;
  shared: boolean;
};

function HabitsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"week" | "month">("week");
  const [showArchived, setShowArchived] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<string>("general");

  const today = new Date();
  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end }).filter((d) => d <= today);
    }
    return eachDayOfInterval({ start: startOfMonth(today), end: today });
  }, [view]).slice().reverse();

  const range = {
    start: format(days[days.length - 1] ?? today, "yyyy-MM-dd"),
    end: format(days[0] ?? today, "yyyy-MM-dd"),
  };

  const { data: allHabits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("id,name,category,color,archived_at,shared,user_id")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data as Habit[]) ?? [];
    },
    enabled: !!user,
  });

  const visibleHabits = allHabits.filter((h) => {
    if (showArchived ? !h.archived_at : !!h.archived_at) return false;
    if (filterCat !== "all" && h.category !== filterCat) return false;
    return true;
  });

  const { data: viewLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habit_logs", range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs")
        .select("habit_id,date,done")
        .gte("date", range.start).lte("date", range.end);
      if (error) throw error;
      return (data as HabitLog[]) ?? [];
    },
  });

  // All-time logs (done only) for streak calculation
  const { data: allDoneLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habit_logs_all_done"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs")
        .select("habit_id,date,done").eq("done", true);
      if (error) throw error;
      return (data as HabitLog[]) ?? [];
    },
  });

  const logMap = new Map<string, boolean>();
  viewLogs.forEach((l) => logMap.set(`${l.habit_id}:${l.date}`, l.done));

  const addHabit = useMutation({
    mutationFn: async () => {
      const cat = categoryMeta(newCat);
      const { error } = await supabase.from("habits").insert({
        user_id: user!.id, name: newName.trim(), category: cat.value, color: cat.color,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); qc.invalidateQueries({ queryKey: ["habits"] }); },
    onError: (e) => toast.error(e.message),
  });

  const archiveHabit = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.from("habits")
        .update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  const toggleShare = useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      const { error } = await supabase.from("habits").update({ shared }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });


  const deleteHabit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const toggleLog = useMutation({
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: string; done: boolean }) => {
      const { error } = await supabase.from("habit_logs")
        .upsert({ user_id: user!.id, habit_id: habitId, date, done }, { onConflict: "habit_id,date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habit_logs"] }).then(() => qc.invalidateQueries({ queryKey: ["habit_logs_all_done"] })),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Habits</h1>
        <div className="flex items-center gap-2">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-8 w-[140px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {HABIT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            {(["week", "month"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-3 py-1 capitalize ${view === v ? "bg-muted" : "text-muted-foreground"}`}>
                This {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowArchived((s) => !s)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${showArchived ? "bg-muted" : "text-muted-foreground"}`}
          >
            <Archive className="h-3.5 w-3.5" /> {showArchived ? "Viewing archived" : "Archived"}
          </button>
        </div>
      </div>

      {!showArchived && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (newName.trim()) addHabit.mutate(); }}
          className="mt-6 flex gap-2"
        >
          <Input placeholder="New habit…" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HABIT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
        </form>
      )}

      {visibleHabits.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {showArchived ? "No archived habits." : "No habits yet. Add one above."}
        </p>
      ) : (
        <>
          {!showArchived && (
            <div className="mt-6 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-32 px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                    {visibleHabits.map((h) => (
                      <th key={h.id} className="px-3 py-2 text-left font-medium">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: h.color }} />
                            <span className="truncate">{h.name}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              title={h.shared ? "Shared with friends — click to unshare" : "Share with friends"}
                              onClick={() => toggleShare.mutate({ id: h.id, shared: !h.shared })}
                              className={h.shared ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Archive"
                              onClick={() => archiveHabit.mutate({ id: h.id, archive: true })}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const ds = format(d, "yyyy-MM-dd");
                    const isToday = ds === format(today, "yyyy-MM-dd");
                    return (
                      <tr key={ds} className="border-b last:border-0">
                        <td className={`px-3 py-2 text-muted-foreground ${isToday ? "font-medium text-foreground" : ""}`}>
                          {format(d, "EEE, MMM d")}{isToday && " · Today"}
                        </td>
                        {visibleHabits.map((h) => {
                          const done = logMap.get(`${h.id}:${ds}`) ?? false;
                          return (
                            <td key={h.id} className="px-3 py-2">
                              <Checkbox
                                checked={done}
                                onCheckedChange={(v) => toggleLog.mutate({ habitId: h.id, date: ds, done: !!v })}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {showArchived ? "Archived habits" : `Streaks & completion this ${view}`}
            </h2>
            {visibleHabits.map((h) => {
              const total = days.length;
              const done = days.filter((d) => logMap.get(`${h.id}:${format(d, "yyyy-MM-dd")}`)).length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const { current, longest } = computeStreaks(h.id, allDoneLogs);
              const cat = categoryMeta(h.category);
              return (
                <div key={h.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: h.color }} />
                      <span className="text-sm font-medium">{h.name}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title="Current streak">
                        <Flame className="h-3.5 w-3.5 text-orange-500" /> {current}d
                      </span>
                      <span className="inline-flex items-center gap-1" title="Longest streak">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" /> {longest}d
                      </span>
                      {!showArchived && <span>{done}/{total} · {pct}%</span>}
                      {showArchived ? (
                        <>
                          <button
                            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted"
                            onClick={() => archiveHabit.mutate({ id: h.id, archive: false })}
                          >
                            <ArchiveRestore className="h-3 w-3" /> Restore
                          </button>
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteHabit.mutate(h.id)}
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {!showArchived && <Progress value={pct} className="mt-2 h-1.5" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
