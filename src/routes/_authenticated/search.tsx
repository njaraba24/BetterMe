import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { BookText, CheckSquare, Repeat, Search as SearchIcon, Target, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

type Hit = { kind: "habit" | "task" | "goal" | "journal" | "finance"; id: string; title: string; sub?: string; to: string };

function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const term = debounced;

  const { data: hits = [], isFetching } = useQuery<Hit[]>({
    queryKey: ["global-search", term, user?.id],
    enabled: term.length >= 2 && !!user,

    queryFn: async () => {
      const like = `%${term}%`;
      const [habits, tasks, goals, journal, fin] = await Promise.all([
        supabase.from("habits").select("id,name").ilike("name", like).limit(10),
        supabase.from("tasks").select("id,title").ilike("title", like).limit(10),
        supabase.from("goals").select("id,title").ilike("title", like).limit(10),
        supabase.from("journal_pages").select("id,title,content").or(`title.ilike.${like},content.ilike.${like}`).limit(10),
        supabase.from("finance_entries").select("id,category,note,amount").or(`category.ilike.${like},note.ilike.${like}`).limit(10),
      ]);
      const out: Hit[] = [];
      (habits.data ?? []).forEach((h: { id: string; name: string }) =>
        out.push({ kind: "habit", id: h.id, title: h.name, to: "/habits" }));
      (tasks.data ?? []).forEach((t: { id: string; title: string }) =>
        out.push({ kind: "task", id: t.id, title: t.title, to: "/tasks" }));
      (goals.data ?? []).forEach((g: { id: string; title: string }) =>
        out.push({ kind: "goal", id: g.id, title: g.title, to: "/goals" }));
      (journal.data ?? []).forEach((j: { id: string; title: string; content: string }) =>
        out.push({ kind: "journal", id: j.id, title: j.title || "Untitled", sub: j.content?.slice(0, 80), to: "/journal" }));
      (fin.data ?? []).forEach((f: { id: string; category: string; note: string | null; amount: number }) =>
        out.push({ kind: "finance", id: f.id, title: f.category, sub: f.note ?? `${f.amount}`, to: "/finance" }));
      return out;
    },
  });

  const iconFor = (k: Hit["kind"]) =>
    k === "habit" ? Repeat : k === "task" ? CheckSquare : k === "goal" ? Target : k === "journal" ? BookText : Wallet;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search across habits, tasks, goals, journal, finance…"
          className="pl-9"
        />
      </div>

      {term.length < 2 && <p className="mt-8 text-sm text-muted-foreground">Type at least 2 characters.</p>}
      {term.length >= 2 && !isFetching && hits.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No matches.</p>
      )}

      <ul className="mt-6 divide-y rounded-lg border">
        {hits.map((h) => {
          const Icon = iconFor(h.kind);
          return (
            <li key={`${h.kind}-${h.id}`}>
              <Link to={h.to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{h.title}</div>
                  {h.sub && <div className="truncate text-xs text-muted-foreground">{h.sub}</div>}
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {h.kind}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
