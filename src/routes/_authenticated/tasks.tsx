import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Flag, Sparkles, Loader2, CalendarIcon, Clock } from "lucide-react";
import { format, isToday, isTomorrow, isPast, isThisWeek, addDays } from "date-fns";
import { toast } from "sonner";
import { parseTaskNL } from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type Priority = "low" | "medium" | "high";
type Status = "todo" | "ongoing" | "done" | "blocked";
type Task = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  due_time: string | null;
  status: Status;
  priority: Priority;
  created_at: string;
};
type SortKey = "due" | "priority" | "created";

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<Priority, string> = {
  high: "text-destructive",
  medium: "text-accent",
  low: "text-muted-foreground",
};

const STATUSES: Status[] = ["todo", "ongoing", "done", "blocked"];
const STATUS_STYLE: Record<Status, string> = {
  todo: "bg-muted text-muted-foreground",
  ongoing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function smartDateLabel(dateStr: string | null, timeStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  let label: string;
  if (isToday(d)) label = "Today";
  else if (isTomorrow(d)) label = "Tomorrow";
  else if (isThisWeek(d, { weekStartsOn: 1 })) label = format(d, "EEEE");
  else label = format(d, "MMM d");
  if (timeStr) label += ` · ${timeStr}`;
  const overdue = isPast(d) && !isToday(d);
  return { label, overdue };
}

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [sort, setSort] = useState<SortKey>("due");
  const [nlText, setNlText] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const parseFn = useServerFn(parseTaskNL);

  const quickAdd = useMutation({
    mutationFn: async () => {
      const parsed = await parseFn({ data: { text: nlText.trim() } });
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id,
        title: parsed.title,
        due_date: parsed.due_date,
        priority: parsed.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNlText(""); qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task added"); },
    onError: (e) => toast.error(e.message),
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Task[]) ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id,
        title: title.trim(),
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        due_time: dueTime || null,
        priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle(""); setDueDate(undefined); setDueTime(""); setPriority("medium");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        done,
        status: done ? "done" : "todo",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("tasks").update({
        status,
        done: status === "done",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const updatePriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: Priority }) => {
      const { error } = await supabase.from("tasks").update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : filter === "active" ? !t.done : t.done,
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "due") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const dateCmp = a.due_date.localeCompare(b.due_date);
      if (dateCmp !== 0) return dateCmp;
      return (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99");
    }
    if (sort === "priority") {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return b.created_at.localeCompare(a.created_at);
  });

  const cyclePriority = (p: Priority): Priority =>
    p === "low" ? "medium" : p === "medium" ? "high" : "low";
  const cycleStatus = (s: Status): Status => {
    const i = STATUSES.indexOf(s);
    return STATUSES[(i + 1) % STATUSES.length];
  };

  const quickDate = (d: Date | undefined) => setDueDate(d);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>

      <form onSubmit={(e) => { e.preventDefault(); if (nlText.trim()) quickAdd.mutate(); }}
        className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
          <Input
            placeholder='Try "gym tomorrow at 7am" or "call mom friday"'
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            className="pl-9"
            disabled={quickAdd.isPending}
          />
        </div>
        <Button type="submit" disabled={quickAdd.isPending || !nlText.trim()} variant="secondary">
          {quickAdd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "AI add"}
        </Button>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">AI parses the date, time and priority for you.</p>

      <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(); }}
        className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-[200px] flex-1" />

          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className={cn("w-[170px] justify-start font-normal", !dueDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "EEE, MMM d") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-wrap gap-1 border-b p-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => { quickDate(new Date()); setDateOpen(false); }}>Today</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { quickDate(addDays(new Date(), 1)); setDateOpen(false); }}>Tomorrow</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { quickDate(addDays(new Date(), 7)); setDateOpen(false); }}>In a week</Button>
                {dueDate && <Button type="button" size="sm" variant="ghost" onClick={() => { setDueDate(undefined); setDateOpen(false); }}>Clear</Button>}
              </div>
              <Calendar mode="single" selected={dueDate} onSelect={(d) => { setDueDate(d); setDateOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <TimePicker value={dueTime} onChange={setDueTime} />

          <div className="inline-flex rounded-md border p-0.5 text-xs">
            {(["low", "medium", "high"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPriority(p)}
                className={`rounded px-2 py-1 capitalize ${priority === p ? "bg-muted" : "text-muted-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
          <Button size="icon" type="submit"><Plus className="h-4 w-4" /></Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border p-0.5 text-sm">
          {(["active", "all", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 capitalize ${filter === f ? "bg-muted" : "text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort</span>
          <div className="inline-flex rounded-md border p-0.5">
            {(["due", "priority", "created"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={`rounded px-2 py-1 capitalize ${sort === s ? "bg-muted text-foreground" : ""}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y rounded-lg border">
        {sorted.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No tasks.</li>}
        {sorted.map((t) => {
          const dl = smartDateLabel(t.due_date, t.due_time);
          const status: Status = t.status ?? (t.done ? "done" : "todo");
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Checkbox checked={t.done} onCheckedChange={(v) => toggle.mutate({ id: t.id, done: !!v })} />
              <button
                onClick={() => updatePriority.mutate({ id: t.id, priority: cyclePriority(t.priority) })}
                title={`Priority: ${t.priority} (click to change)`}
                className={`shrink-0 ${PRIORITY_COLOR[t.priority]}`}
              >
                <Flag className={`h-3.5 w-3.5 ${t.priority === "low" ? "" : "fill-current"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className={status === "done" ? "text-muted-foreground line-through" : ""}>{t.title}</div>
                {dl && (
                  <div className={`text-xs ${dl.overdue && status !== "done" ? "text-destructive" : "text-muted-foreground"}`}>
                    {dl.label}{dl.overdue && status !== "done" ? " · overdue" : ""}
                  </div>
                )}
              </div>
              <button
                onClick={() => updateStatus.mutate({ id: t.id, status: cycleStatus(status) })}
                title="Click to change status"
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[status]}`}
              >
                {status}
              </button>
              <button onClick={() => del.mutate(t.id)} className="text-muted-foreground hover:text-destructive" title="Delete task">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTimeLabel(v: string) {
  if (!v) return "Pick time";
  const [hStr, mStr] = v.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mStr} ${suffix}`;
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hStr, mStr] = value ? value.split(":") : ["", ""];
  const h24 = value ? parseInt(hStr, 10) : null;
  const period: "AM" | "PM" = h24 === null ? "AM" : h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === null ? null : ((h24 + 11) % 12) + 1;
  const minute = mStr || "00";

  const commit = (nh12: number, nm: string, np: "AM" | "PM") => {
    let nh = nh12 % 12;
    if (np === "PM") nh += 12;
    onChange(`${String(nh).padStart(2, "0")}:${nm}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-[140px] justify-start font-normal", !value && "text-muted-foreground")}>
          <Clock className="mr-2 h-4 w-4" />
          {formatTimeLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-2">
          <div className="flex flex-col">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase text-muted-foreground">Hr</div>
            <div className="h-48 w-12 overflow-y-auto rounded border">
              {hours.map((h) => (
                <button key={h} type="button"
                  onClick={() => commit(h, minute, period)}
                  className={`w-full px-2 py-1 text-sm hover:bg-muted ${h12 === h ? "bg-muted font-medium" : ""}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase text-muted-foreground">Min</div>
            <div className="h-48 w-14 overflow-y-auto rounded border">
              {minutes.map((m) => (
                <button key={m} type="button"
                  onClick={() => commit(h12 ?? 9, m, period)}
                  className={`w-full px-2 py-1 text-sm hover:bg-muted ${minute === m ? "bg-muted font-medium" : ""}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase text-muted-foreground">&nbsp;</div>
            <div className="flex flex-col gap-1">
              {(["AM", "PM"] as const).map((p) => (
                <button key={p} type="button"
                  onClick={() => commit(h12 ?? 9, minute, p)}
                  className={`rounded border px-3 py-1 text-sm ${period === p ? "bg-muted font-medium" : ""}`}>
                  {p}
                </button>
              ))}
              {value && (
                <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                  className="mt-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                Done
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
