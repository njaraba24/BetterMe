import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2, Plus, Minus, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

type Goal = { id: string; title: string; target: number; current: number; unit: string; done: boolean };

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Goal[]) ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goals").insert({
        user_id: user!.id, title: title.trim(), target: Number(target) || 0, unit: unit.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setTarget(""); setUnit(""); qc.invalidateQueries({ queryKey: ["goals"] }); },
    onError: (e) => toast.error(e.message),
  });

  const step = useMutation({
    mutationFn: async ({ g, delta }: { g: Goal; delta: number }) => {
      const next = Math.max(0, Number(g.current) + delta);
      const done = g.target > 0 && next >= g.target;
      const { error } = await supabase.from("goals").update({ current: next, done }).eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("goals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Goals</h1>

      <form onSubmit={(e) => { e.preventDefault(); if (title.trim() && Number(target) > 0) add.mutate(); }}
        className="mt-6 grid grid-cols-[1fr_100px_100px_auto] gap-2">
        <Input placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="number" min="0" placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <Button size="icon" type="submit"><Plus className="h-4 w-4" /></Button>
      </form>

      <div className="mt-6 space-y-3">
        {goals.length === 0 && <p className="text-center text-sm text-muted-foreground">No goals yet.</p>}
        {goals.map((g) => {
          const cur = Number(g.current);
          const tar = Number(g.target);
          const pct = tar > 0 ? Math.min(100, Math.round((cur / tar) * 100)) : 0;
          return (
            <div key={g.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {g.title}
                    {g.done && <Check className="h-4 w-4 text-success" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{cur} / {tar} {g.unit}</div>
                </div>
                <Button size="icon" variant="outline" onClick={() => step.mutate({ g, delta: -1 })}><Minus className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => step.mutate({ g, delta: 1 })}><Plus className="h-4 w-4" /></Button>
                <button onClick={() => del.mutate(g.id)} className="ml-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Progress value={pct} className="mt-3 h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
